import {
  App, Notice, PluginSettingTab,
  Setting
} from "obsidian";
import {
  hslToHex,
  hexToHSL
} from "./utility";
import AdjacencyMatrixMakerPlugin from "./main";

// !SECTION Matrix Modal
// SECTION SettingsTab
export class AdjacencyMatrixMakerSettingTab extends PluginSettingTab {
  plugin: AdjacencyMatrixMakerPlugin;

  constructor(app: App, plugin: AdjacencyMatrixMakerPlugin) {
    super(app, plugin);
    // this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", {
      text: "Settings for Adjacency Matrix Maker",
    });

    // SECTION Custom settings
    const coloursDiv = containerEl.createDiv();

    // Main colour picker
    const mainColourDiv = coloursDiv.createDiv();
    mainColourDiv.createEl("h4", {
      text: "Main colour",
    });
    const mainColourPicker = mainColourDiv.createEl("input", { type: "color" });

    mainColourPicker.value = hslToHex(
      ...this.plugin.settings.mainColourComponents
    );
    mainColourPicker.addEventListener("change", async () => {
      this.plugin.settings.mainColourComponents = hexToHSL(
        mainColourPicker.value
      );
      await this.plugin.saveSettings();
    });

    // Background colour picker
    const backgroundColourDiv = coloursDiv.createDiv();
    backgroundColourDiv.createEl("h4", {
      text: "Background colour",
    });
    const backgroundColourPicker = backgroundColourDiv.createEl("input", {
      type: "color",
    });

    backgroundColourPicker.value = this.plugin.settings.backgroundColour;
    backgroundColourPicker.addEventListener("change", async () => {
      this.plugin.settings.backgroundColour = backgroundColourPicker.value;
      await this.plugin.saveSettings();
    });

    // // Folder squares colour picker
    // const folderSquaresColourDiv = coloursDiv.createDiv();
    // folderSquaresColourDiv.createEl("h4", {
    //   text: "Folder squares colour",
    // });
    // const folderSquaresColourPicker = folderSquaresColourDiv.createEl("input", {
    //   type: "color",
    // });
    // folderSquaresColourPicker.value = this.plugin.settings.folderSquaresColour;
    // folderSquaresColourPicker.addEventListener("change", async () => {
    //   this.plugin.settings.folderSquaresColour =
    //     folderSquaresColourPicker.value;
    //   await this.plugin.saveSettings();
    // });
    // !SECTION Custom settings
    // SECTION Obsidian Settings
    new Setting(containerEl)
      .setName("Show folders")
      .setDesc("Add squares to the image showing which folder a note is in")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.showFolders)
        .onChange(async (value) => {
          this.plugin.settings.showFolders = value;
          await this.plugin.saveSettings();
        })
      );

    const initialScale = this.plugin.settings.userScale === 0
      ? ""
      : this.plugin.settings.userScale;

    new Setting(containerEl)
      .setName("Image Scale")
      .setDesc(
        "The side length in pixels of each cell in the matrix. A larger scale will make for longer loading times, but a crisper image. The default value is determined by the number of files in your vault (More files = higher scale value). Leave blank to use the default."
      )
      .addText((text) => text
        .setPlaceholder("Scale")
        .setValue(initialScale.toString())
        .onChange(async (newValue) => {
          const newScale = Number(newValue);
          if (!(Number.isInteger(newScale) && newScale >= 0)) {
            new Notice("Scale must be an integer greater than or equal to 1");
            return;
          }
          this.plugin.settings.userScale = newScale;
          await this.plugin.saveSettings();
        //   console.log(this.plugin.settings.userScale)
        })
      );

    new Setting(containerEl)
      .setName("Image name")
      .setDesc(
        "The value used to name a saved image. The name will have the datetime appended automatically"
      )
      .addText((text) => text
        .setPlaceholder("Default name")
        .setValue(this.plugin.settings.imgName)
        .onChange(async (value) => {
          this.plugin.settings.imgName = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Folder path")
      .setDesc(
        'The folder to save the image in. The default is the root of your vault \'/\'. If you do change it, leave out the first slash in front. e.g. To save the image in "Attachments", type in "Attachments" (no quotes)'
      )
      .addText((text) => text
        .setPlaceholder("/")
        .setValue(this.plugin.settings.folderPath)
        .onChange(async (value) => {
          this.plugin.settings.folderPath = value;
          await this.plugin.saveSettings();
        })
      );
    // !SECTION Obsidian Settings
  }
}
