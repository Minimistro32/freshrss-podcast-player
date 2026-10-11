<?php
declare(strict_types=1);

require_once __DIR__ . '/PodcastRenderer.php';

final class PodcastPlayerExtension extends Minz_Extension {

    public function embedsAssets(): bool {
        return $this->getUserConfigurationBool('embed_assets') ?? false;
    }

    public function handleConfigureAction(): void {
        if (Minz_Request::isPost()) {
            $this->setUserConfigurationValue('embed_assets', Minz_Request::paramString('embed_assets') === '1');
        }
    }

    public function init(): void {
        $this->registerHook('entry_before_display', [$this, 'renderEntry']);
        Minz_View::appendStyle($this->getFileUrl('player.css'));
        Minz_View::appendScript($this->getFileUrl('player.js'));
    }

    public function renderEntry(FreshRSS_Entry $entry): FreshRSS_Entry {
        // Rendering only: never change the stored feed or its enclosure metadata.
        $html = $entry->content();
        $scope = hash('sha256', (string)Minz_User::name());
        $result = PodcastRenderer::render(
            $html,
            (string)$entry->id(),
            $scope,
            $this->embedsAssets()
        );
        if ($this->embedsAssets() && str_contains($result, 'data-podcast-player="')
            && !str_contains($result, '<!-- podcast-player-assets:v1 -->')) {
            // Only our bundled code is embedded. Never interpolate article content into executable code.
            $css = file_get_contents(__DIR__ . '/static/player.css');
            $js = file_get_contents(__DIR__ . '/static/player.js');
            if ($css !== false && $js !== false) {
                $result .= "\n<!-- podcast-player-assets:v1 -->"
                    . '<style data-podcast-assets="css">' . str_ireplace('</style', '<\\/style', $css) . '</style>'
                    . '<script data-podcast-assets="js">' . str_ireplace('</script', '<\\/script', $js) . '</script>';
            }
        }
        if ($result !== $html) {
            $entry->_content($result);
        }
        return $entry;
    }
}
