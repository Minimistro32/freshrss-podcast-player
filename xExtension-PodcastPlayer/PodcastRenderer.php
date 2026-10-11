<?php
declare(strict_types=1);

/** Server-rendered markup also travels through FreshRSS's article APIs. */
final class PodcastRenderer {
    public static function render(
        string $html,
        string $entryId,
        string $scope,
        bool $dynamicControls = false
    ): string {
        if (stripos($html, '<audio') === false || !class_exists('DOMDocument')) {
            return $html;
        }

        $dom = new DOMDocument('1.0', 'UTF-8');
        $previous = libxml_use_internal_errors(true);
        try {
            $loaded = $dom->loadHTML(
                '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' . $html . '</body></html>',
                LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING
            );
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
        if (!$loaded) {
            return $html;
        }
        $body = $dom->getElementsByTagName('body')->item(0);
        if (!$body instanceof DOMElement) {
            return $html;
        }
        $xpath = new DOMXPath($dom);
        // Avoid wrapping an entry twice when another render pass calls the hook.
        if ($xpath->query('//*[@data-podcast-player]')->length > 0) {
            return $html;
        }

        $players = $dom->createElement('div');
        $players->setAttribute('class', 'podcast-players');
        $seen = [];
        // Copy the live NodeList before relocating audio nodes.
        $audioNodes = iterator_to_array($dom->getElementsByTagName('audio'));
        foreach ($audioNodes as $audio) {
            $sources = [];
            if ($audio->hasAttribute('src')) {
                $sources[] = $audio->getAttribute('src');
            }
            foreach ($audio->getElementsByTagName('source') as $source) {
                $sources[] = $source->getAttribute('src');
            }
            $sources = array_values(array_filter($sources, [self::class, 'isMediaUrl']));
            if ($sources === []) {
                continue;
            }
            $identity = implode("\n", $sources);
            $oldParent = $audio->parentNode;
            if (isset($seen[$identity])) {
                $oldParent->removeChild($audio);
                self::removeEmptyContainers($oldParent, $body);
                continue;
            }
            $seen[$identity] = true;

            $player = $dom->createElement('div');
            $player->setAttribute('class', 'podcast-player');
            $player->setAttribute('data-podcast-player', hash('sha256', $scope . ':' . $entryId . ':' . $identity));
            $player->setAttribute('data-podcast-scope', $scope);
            $player->setAttribute('role', 'group');
            $player->setAttribute('aria-label', 'Podcast player');

            $audio->setAttribute('controls', 'controls');
            $audio->setAttribute('preload', 'none');
            $audio->removeAttribute('autoplay');
            $player->appendChild($audio);
            self::removeEmptyContainers($oldParent, $body);

            // Populate controls in JavaScript so their labels are absent
            // from article HTML used by RSS clients to build previews.
            $toolbar = $dom->createElement('div');
            $toolbar->setAttribute('class', 'podcast-controls');
            $toolbar->setAttribute('hidden', 'hidden');

            // Experimental mode leaves labels out of the article HTML.
            // Otherwise, preserve the original server-rendered controls.
            if (!$dynamicControls) {
                $heading = $dom->createElement('p');
                $heading->setAttribute('class', 'podcast-heading');
                $heading->appendChild(
                    $dom->createTextNode('Listen to this episode')
                );
                $player->insertBefore($heading, $audio);

                foreach ([
                    'back' => '−15s',
                    'forward' => '+30s',
                    'resume' => 'Resume',
                    'restart' => 'Start over',
                ] as $action => $text) {
                    $button = $dom->createElement('button');
                    $button->appendChild($dom->createTextNode($text));
                    $button->setAttribute('type', 'button');
                    $button->setAttribute('data-podcast-action', $action);
                    $button->setAttribute('disabled', 'disabled');
                    $toolbar->appendChild($button);
                }

                $label = $dom->createElement('label');
                $label->appendChild($dom->createTextNode('Speed '));

                $select = $dom->createElement('select');
                $select->setAttribute('data-podcast-speed', '');
                $select->setAttribute('disabled', 'disabled');

                foreach (['0.8', '1', '1.3', '1.5', '1.8', '2'] as $speed) {
                    $option = $dom->createElement('option');
                    $option->setAttribute('value', $speed);
                    if ($speed === '1') {
                        $option->setAttribute('selected', 'selected');
                    }
                    $option->appendChild($dom->createTextNode($speed . '×'));
                    $select->appendChild($option);
                }

                $label->appendChild($select);
                $toolbar->appendChild($label);

                $status = $dom->createElement('span');
                $status->setAttribute('class', 'podcast-status');
                $status->setAttribute('role', 'status');
                $toolbar->appendChild($status);
            }

            $player->appendChild($toolbar);
            $players->appendChild($player);

            // Extra separation for clients using the experimental embed option.
            if ($dynamicControls) {
                $spacer = $dom->createElement('div');
                $spacer->setAttribute('aria-hidden', 'true');
                $spacer->setAttribute(
                    'style',
                    'display:block;clear:both;height:4px;'
                    . 'padding-bottom:2px;line-height:0;font-size:0.5rem;'
                );
                $spacer->appendChild($dom->createTextNode("\u{00A0}"));
                $players->appendChild($spacer);
            }
        }

        if (!$players->hasChildNodes()) {
            return $html;
        }
        $body->insertBefore($players, $body->firstChild);
        $result = '';
        foreach ($body->childNodes as $child) {
            $result .= $dom->saveHTML($child);
        }
        return $result;
    }

    private static function isMediaUrl(string $url): bool {
        // Existing feed markup is sanitized by FreshRSS; do not create controls for active URL schemes.
        return $url !== '' && !preg_match('/[\x00-\x20]/', $url)
            && (!preg_match('/^[a-z][a-z0-9+.-]*:/i', $url) || preg_match('/^https?:\/\//i', $url));
    }

    private static function removeEmptyContainers(?DOMNode $node, DOMElement $body): void {
        while ($node instanceof DOMElement && $node !== $body
            && in_array(strtolower($node->tagName), ['p', 'div', 'figure', 'span'], true)
            && trim($node->textContent) === '' && $node->getElementsByTagName('*')->length === 0) {
            $parent = $node->parentNode;
            $parent->removeChild($node);
            $node = $parent;
        }
    }
}
