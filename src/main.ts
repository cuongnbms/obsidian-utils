import { Plugin } from "obsidian";
import { ModeRadioFeature } from "./features/mode-radio";

/**
 * Each feature is a Component in src/features/. addChild ties its lifecycle to the plugin:
 * it loads with the plugin and unloads (cleans up) when the plugin is disabled.
 */
export default class ObsidianUtilsPlugin extends Plugin {
	onload() {
		this.addChild(new ModeRadioFeature(this.app));
	}
}
