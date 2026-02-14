from aqt import mw


class AddonConfig:
    DEFAULT_PORT = 8766
    DEFAULT_POST_MINE_ACTION = 2

    def __init__(self, module_name: str) -> None:
        self._module_name = module_name
        self._init_config()

    def _init_config(self) -> None:
        config_defaults = {
            "port": self.DEFAULT_PORT,
            "postMineAction": self.DEFAULT_POST_MINE_ACTION,
        }

        self._config = mw.addonManager.getConfig(self._module_name)
        if self._config is None:
            self._config = {}

        changed = False
        for key, default_value in config_defaults.items():
            if key not in self._config:
                self._config[key] = default_value
                changed = True

        if changed:
            self._save_config()

    def _save_config(self) -> None:
        mw.addonManager.writeConfig(self._module_name, self._config)

    def get_port(self) -> int:
        return int(self._config.get("port", self.DEFAULT_PORT))

    def get_post_mine_action(self) -> int:
        return int(self._config.get("postMineAction", self.DEFAULT_POST_MINE_ACTION))
