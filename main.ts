import {
  App,
  ButtonComponent,
  debounce,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  Workspace,
  WorkspaceLeaf,
} from "obsidian";
interface MyPluginSettings {
  mainColourHue: number;
  mainColourSat: number;
  mainColourLight: number;
  backgroundColourHue: number;
  backgroundColourSat: number;
  backgroundColourLight: number;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  mainColourHue: 214,
  mainColourSat: 84,
  mainColourLight: 57,
  backgroundColourHue: 20,
  backgroundColourSat: 17,
  backgroundColourLight: 3,
};

// Functions
/// Source: https://stackoverflow.com/questions/36721830/convert-hsl-to-rgb-and-hex
function hslToHex(h: number, s: number, l: number) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0"); // convert to Hex and prefix "0" if needed
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function convertDataURIToBinary(dataURI: string) {
  const base64Index: number = dataURI.indexOf(";base64,") + ";base64,".length;
  const base64: string = dataURI.substring(base64Index);
  const raw = window.atob(base64);
  const rawLength = raw.length;
  let array = new Uint8Array(new ArrayBuffer(rawLength));
  for (let i = 0; i < rawLength; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array;
}

function sumRows(array: number[][]) {
  const result: number[] = [];
  array.forEach((row, i) => {
    row.reduce((a, b) => (result[i] = a + b));
  });
  return result;
}

function normalise(array: number[]) {
  const max = Math.max(...array);
  return array.map((x) => x / max);
}

function drawAdjAsImage(
  scale: number,
  alphas: number[],
  adjArray: number[][],
  canvas: HTMLCanvasElement,
  colours: number[],
  offsetX: number = 0,
  offsetY: number = 0
) {
  const ctx = canvas.getContext("2d");
  const size = alphas.length;
  canvas.width = size * scale;
  canvas.height = canvas.height;
  const [bgH, bgS, bgL, mnH, mnS, mnL] = colours;

  for (let i = offsetX; i < size; i++) {
    // Where the alpha of that row is proportional to the number of coloured cells in that row
    /// Make the more "popular" notes pop
    const alpha = alphas[i] / 1.5 + 0.33333333;

    for (let j = offsetY; j < size; j++) {
      // Position of the top-left corner of the next pixel
      const x = i * scale;
      const y = j * scale;
      let cellColour: string;

      // Change colour if the two notes are linked
      if (adjArray[i][j] === 0) {
        cellColour = `hsl(${bgH}, ${bgS}%, ${bgL}%)`;
      } else {
        cellColour = `hsla(${mnH}, ${mnS}%, ${mnL}%, ${alpha})`;
      }

      // Draw the cell
      ctx.beginPath();
      ctx.fillStyle = cellColour;
      ctx.fillRect(x, y, scale, scale);
    }
  }
  const img = new Image();
  img.src = canvas.toDataURL();
  return img;
}

export default class MyPlugin extends Plugin {
  settings: MyPluginSettings;

  async onload() {
    console.log("Loading Adjacency Matrix Maker plugin");

    await this.loadSettings();

    this.addRibbonIcon("dice", "Adjacency Matrix", this.makeAdjacencyMatrix);

    this.addCommand({
      id: "adjacency-matrix",
      name: "Open Adjacency Matrix",
      callback: this.makeAdjacencyMatrix,
    });

    this.addSettingTab(new AdjacencyMatrixMakerSettingTab(this.app, this));

    this.registerCodeMirror((cm: CodeMirror.Editor) => {
      // console.log("codemirror", cm);
    });
  }

  // Does `from` have a link going to `to`?
  linkedQ(from: TFile, to: TFile) {
    const fromLinkObjs = this.app.metadataCache.getFileCache(from).links || [];
    const fromLinks = fromLinkObjs.map(
      (linkObj) => linkObj.link.replace(/#.+/g, "") || ""
    );
    return fromLinks.includes(to.basename);
  }

  populateAdjacencyMatrixArr(files: TFile[]) {
    const size = files.length;
    const adjArray: number[][] = [];

    for (let i = 0; i < size; i++) {
      adjArray.push([]);
      for (let j = 0; j < size; j++) {
        // 1 or 0 so that sumRows works (instead of true or false)
        adjArray[i][j] = this.linkedQ(files[i], files[j]) ? 1 : 0;
      }
    }
    return adjArray;
  }

  makeAdjacencyMatrix = async () => {
    const files: TFile[] = this.app.vault.getMarkdownFiles();
    const size = files.length;
    const scale = size < 50 ? 16 : size < 100 ? 8 : size < 200 ? 4 : 2;

    // Canvas setup
    const canvas = document.createElement("canvas");
    canvas.width = size * scale;
    canvas.height = size * scale;

    const adjArray = this.populateAdjacencyMatrixArr(files);
    const alphas = normalise(sumRows(adjArray));

    const colours = [
      this.settings.backgroundColourHue,
      this.settings.backgroundColourSat,
      this.settings.backgroundColourLight,
      this.settings.mainColourHue,
      this.settings.mainColourSat,
      this.settings.mainColourLight,
    ];

    const img = drawAdjAsImage(scale, alphas, adjArray, canvas, colours);

    new MatrixModal(this.app, img, files, scale, adjArray, colours).open();
  };

  onunload() {
    console.log("unloading plugin");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class MatrixModal extends Modal {
  private img: HTMLImageElement;
  // private canvas: HTMLCanvasElement;
  private files: TFile[];
  private scale: number;
  private adjArray: number[][];
  private colours: number[];

  constructor(
    app: App,
    img: HTMLImageElement,
    files: TFile[],
    scale: number,
    adjArray: number[][],
    colours: number[]
  ) {
    super(app);
    this.img = img;
    this.files = files;
    this.scale = scale;
    this.adjArray = adjArray;
    this.colours = colours;
  }

  interval: NodeJS.Timeout;

  async onOpen() {
    const modal = this;
    const app = this.app;
    const img = this.img;
    const scale = this.scale;
    const files = this.files;
    const adjArray = this.adjArray;
    // const colours = this.colours;

    // Add the canvas to the modal
    let { contentEl } = this;
    contentEl.addClass("contentEl");
    const canvas = contentEl.createEl("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    await ctx.drawImage(img, 0, 0);

    // Save image button
    const buttonRow = contentEl.createDiv({ cls: "matrixModalButtons" });
    const saveImageButton = buttonRow.createEl("button", {
      text: "Save Image",
    });
    const resetScaleButton = buttonRow.createEl("button", {
      text: "Reset Scale",
    });

    // Tooltip
    const tooltip = contentEl.createDiv({ cls: "adj-tooltip" });
    const tooltipText = tooltip.createSpan({ cls: "adj-tooltip-text" });

    let newScale = scale;

    ////// Test code /////////
    const mouse = {
      x: 0,
      y: 0,
      w: 0,
      alt: false,
      shift: false,
      ctrl: false,
      buttonLastRaw: 0, // user modified value
      buttonRaw: 0,
      over: false,
      buttons: [1, 2, 4, 6, 5, 3], // masks for setting and clearing button raw bits;
    };

    

    function mouseMove(event: MouseEvent | WheelEvent) {
      mouse.x = event.offsetX;
      mouse.y = event.offsetY;
      // mouse.alt = event.altKey;
      // mouse.shift = event.shiftKey;
      // mouse.ctrl = event.ctrlKey;
      if (event.type === "mousedown") {
        event.preventDefault();
        mouse.buttonRaw |= mouse.buttons[event.which - 1];
      } else if (event.type === "mouseup") {
        mouse.buttonRaw &= mouse.buttons[event.which + 2];
      } else if (event.type === "mouseout") {
        mouse.buttonRaw = 0;
        mouse.over = false;
      } else if (event.type === "mouseover") {
        mouse.over = true;
      } else if (event.type === "mousewheel") {
        event.preventDefault();
        mouse.w = -event.deltaY;
      }
      // else if (event.type === "DOMMouseScroll") {
      //   // FF you pedantic doffus
      //   mouse.w = -event.detail;
      // }
    }

    function setupMouse(e: HTMLElement) {
      e.addEventListener("mousemove", mouseMove);
      e.addEventListener("mousedown", mouseMove);
      e.addEventListener("mouseup", mouseMove);
      e.addEventListener("mouseout", mouseMove);
      e.addEventListener("mouseover", mouseMove);
      e.addEventListener("mousewheel", mouseMove);
      // e.addEventListener("DOMMouseScroll", mouseMove); // fire fox

      e.addEventListener(
        "contextmenu",
        function (e) {
          e.preventDefault();
        },
        false
      );
    }
    setupMouse(canvas);

    // Real space, real, r (prefix) refers to the transformed canvas space.
    // c (prefix), chase is the value that chases a requiered value
    var displayTransform = {
      x: 0,
      y: 0,
      ox: 0,
      oy: 0,
      scale: 1,
      rotate: 0,
      cx: 0, // chase values Hold the actual display
      cy: 0,
      cox: 0,
      coy: 0,
      cscale: 1,
      crotate: 0,
      dx: 0, // deltat values
      dy: 0,
      dox: 0,
      doy: 0,
      dscale: 1,
      drotate: 0,
      drag: 0.2, // drag for movements
      accel: 0.9, // acceleration
      matrix: [0, 0, 0, 0, 0, 0], // main matrix
      invMatrix: [0, 0, 0, 0, 0, 0], // invers matrix;
      mouseX: 0,
      mouseY: 0,
      ctx: ctx,
      setTransform: function () {
        let m = this.matrix;
        let i = 0;
        this.ctx.setTransform(m[i++], m[i++], m[i++], m[i++], m[i++], m[i++]);
      },
      setHome: function () {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      },
      update: function () {
        // smooth all movement out. drag and accel control how this moves
        // acceleration
        this.dx += (this.x - this.cx) * this.accel;
        this.dy += (this.y - this.cy) * this.accel;
        this.dox += (this.ox - this.cox) * this.accel;
        this.doy += (this.oy - this.coy) * this.accel;
        this.dscale += (this.scale - this.cscale) * this.accel;
        // this.drotate += (this.rotate - this.crotate) * this.accel;

        // drag
        this.dx *= this.drag;
        this.dy *= this.drag;
        this.dox *= this.drag;
        this.doy *= this.drag;
        this.dscale *= this.drag;
        // this.drotate *= this.drag;

        // set the chase values. Chase chases the requiered values
        this.cx += this.dx;
        this.cy += this.dy;
        this.cox += this.dox;
        this.coy += this.doy;
        this.cscale += this.dscale;
        // this.crotate += this.drotate;

        // create the display matrix
        this.matrix[0] = Math.cos(this.crotate) * this.cscale;
        this.matrix[1] = Math.sin(this.crotate) * this.cscale;
        this.matrix[2] = -this.matrix[1];
        this.matrix[3] = this.matrix[0];

        // set the coords relative to the origin
        this.matrix[4] =
          -(this.cx * this.matrix[0] + this.cy * this.matrix[2]) + this.cox;
        this.matrix[5] =
          -(this.cx * this.matrix[1] + this.cy * this.matrix[3]) + this.coy;

        // create invers matrix
        let det =
          this.matrix[0] * this.matrix[3] - this.matrix[1] * this.matrix[2];
        this.invMatrix[0] = this.matrix[3] / det;
        this.invMatrix[1] = -this.matrix[1] / det;
        this.invMatrix[2] = -this.matrix[2] / det;
        this.invMatrix[3] = this.matrix[0] / det;

        // check for mouse. Do controls and get real position of mouse.
        if (mouse !== undefined) {
          // if there is a mouse get the real cavas coordinates of the mouse
          if (mouse.oldX !== undefined && (mouse.buttonRaw & 1) === 1) {
            // check if panning (middle button)
            var mdx = mouse.x - mouse.oldX; // get the mouse movement
            var mdy = mouse.y - mouse.oldY;
            // get the movement in real space
            var mrx = mdx * this.invMatrix[0] + mdy * this.invMatrix[2];
            var mry = mdx * this.invMatrix[1] + mdy * this.invMatrix[3];
            this.x -= mrx;
            this.y -= mry;
          }
          // do the zoom with mouse wheel
          if (mouse.w !== undefined && mouse.w !== 0) {
            this.ox = mouse.x;
            this.oy = mouse.y;
            this.x = this.mouseX;
            this.y = this.mouseY;
            /* Special note from answer */
            // comment out the following is you change drag and accel
            // and the zoom does not feel right (lagging and not
            // zooming around the mouse
            /*
             */
            this.cox = mouse.x;
            this.coy = mouse.y;
            this.cx = this.mouseX;
            this.cy = this.mouseY;

            if (mouse.w > 0) {
              // zoom in
              this.scale *= 1.1;
              mouse.w -= 20;
              if (mouse.w < 0) {
                mouse.w = 0;
              }
            }
            if (mouse.w < 0) {
              // zoom out
              this.scale *= 1 / 1.1;
              mouse.w += 20;
              if (mouse.w > 0) {
                mouse.w = 0;
              }
            }
          }
          // get the real mouse position
          var screenX = mouse.x - this.cox;
          var screenY = mouse.y - this.coy;
          this.mouseX =
            this.cx +
            (screenX * this.invMatrix[0] + screenY * this.invMatrix[2]);
          this.mouseY =
            this.cy +
            (screenX * this.invMatrix[1] + screenY * this.invMatrix[3]);
          mouse.rx = this.mouseX; // add the coordinates to the mouse. r is for real
          mouse.ry = this.mouseY;
          // save old mouse position
          mouse.oldX = mouse.x;
          mouse.oldY = mouse.y;
        }
      },
    };

    function update() {
      console.count("updating");
      // update the transform
      displayTransform.update();
      // set home transform to clear the screem
      displayTransform.setHome();

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      displayTransform.setTransform();
      ctx.drawImage(img, 0, 0);
      // ctx.fillStyle = "white";

      if (mouse.buttonRaw === 4) {
        // right click to return to home
        displayTransform.x = 0;
        displayTransform.y = 0;
        displayTransform.scale = 1;
        displayTransform.rotate = 0;
        displayTransform.ox = 0;
        displayTransform.oy = 0;
      }
    }
    update();
    this.interval = setInterval(update, 30);

    function handleCanvasInteraction(e: MouseEvent) {
      const x = e.offsetX;
      const y = e.offsetY;
      const realx = mouse.rx;
      const realy = mouse.ry;

      // Convert coord to cell number
      const i = Math.round(realx / newScale - 0.5);
      const j = Math.round(realy / newScale - 0.5);

      // Pick the two files that cell refers to
      const fileI = files[i];
      const fileJ = files[j];

      // If hovering over linked notes, show tooltip, and move it there
      if (adjArray[i][j] === 1) {
        document.body.style.cursor = "pointer";
        tooltip.addClass("show");
        tooltip.style.transform = `translate(${x + 15}px, ${
          y - canvas.height - 80
        }px)`;
        tooltipText.innerText = `${fileI.basename} → ${fileJ.basename}`;
      } else {
        document.body.style.cursor = "initial";
        // Hide the tooltip
        tooltip.removeClass("show");
      }
    }

    canvas.addEventListener(
      "mousemove",
      debounce(handleCanvasInteraction, 30, true)
    );

    async function openClickedCellAsFile(e: MouseEvent) {
      const realx = mouse.rx;
      const realy = mouse.ry;

      // Convert coord to cell number
      const i = Math.round(realx / newScale - 0.5);
      const j = Math.round(realy / newScale - 0.5);

      // Pick the two files that cell refers to
      const fileI = files[i];
      // const fileJ = files[j];

      if (adjArray[i][j] === 1) {
        // Open the clicked cell (from, not to) in the active leaf
        await app.workspace.activeLeaf.openFile(fileI);

        modal.close();
      }
    }

    canvas.addEventListener("click", openClickedCellAsFile);

    resetScaleButton.addEventListener("click", () => {
      displayTransform.x = 0;
      displayTransform.y = 0;
      displayTransform.scale = 1;
      displayTransform.rotate = 0;
      displayTransform.ox = 0;
      displayTransform.oy = 0;
    });

    function saveCanvasAsImage() {
      const arrBuff = convertDataURIToBinary(img.src);

      // Add the current datetime to the image name
      const now = window.moment().format("YYYYMMDDHHmmSS");
      // Save image to root. This could be improved to let the user choose the path
      app.vault.createBinary(`/adj ${now}.png`, arrBuff);
      new Notice("Image saved");
    }

    saveImageButton.addEventListener("click", saveCanvasAsImage);
  }

  onClose() {
    let { contentEl } = this;
    clearInterval(this.interval);
    contentEl.empty();
  }
}

class AdjacencyMatrixMakerSettingTab extends PluginSettingTab {
  plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", {
      text: "Settings for Adjacency Matrix Maker",
    });
    containerEl.createEl("p", {
      text: "You currently can't use the colour pickers to actually choose the colours. It is just to show the result.",
    });

    const coloursDiv = containerEl.createDiv();

    // Main colour picker
    const mainColourDiv = coloursDiv.createDiv();
    mainColourDiv.createEl("h4", {
      text: "Main colour",
    });
    const mainColourPicker = mainColourDiv.createEl("input", { type: "color" });
    // Update value based on chosen slider settings
    mainColourPicker.value = hslToHex(
      this.plugin.settings.mainColourHue,
      this.plugin.settings.mainColourSat,
      this.plugin.settings.mainColourLight
    );

    // Background colour picker
    const backgroundColourDiv = coloursDiv.createDiv();
    backgroundColourDiv.createEl("h4", {
      text: "Background colour",
    });
    const backgroundColourPicker = backgroundColourDiv.createEl("input", {
      type: "color",
    });
    backgroundColourPicker.value = hslToHex(
      this.plugin.settings.backgroundColourHue,
      this.plugin.settings.backgroundColourSat,
      this.plugin.settings.backgroundColourLight
    );

    new Setting(containerEl)
      .setName("Main colour hue")
      .setDesc("Hue of the colour to use when two notes are linked")
      .addSlider((slider) =>
        slider
          .setLimits(0, 360, 1)
          .setValue(this.plugin.settings.mainColourHue)
          .onChange((value) => {
            this.plugin.settings.mainColourHue = value;
            this.plugin.saveData(this.plugin.settings);
            mainColourPicker.value = hslToHex(
              value,
              this.plugin.settings.mainColourSat,
              this.plugin.settings.mainColourLight
            );
          })
      );

    new Setting(containerEl)
      .setName("Main colour saturation")
      .setDesc("Saturation of the colour to use when two notes are linked")
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 1)
          .setValue(this.plugin.settings.mainColourSat)
          .onChange((value) => {
            this.plugin.settings.mainColourSat = value;
            this.plugin.saveData(this.plugin.settings);
            mainColourPicker.value = hslToHex(
              this.plugin.settings.mainColourHue,
              value,
              this.plugin.settings.mainColourLight
            );
          })
      );

    new Setting(containerEl)
      .setName("Main colour light")
      .setDesc("Light of the colour to use when two notes are linked")
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 1)
          .setValue(this.plugin.settings.mainColourLight)
          .onChange((value) => {
            this.plugin.settings.mainColourLight = value;
            this.plugin.saveData(this.plugin.settings);
            mainColourPicker.value = hslToHex(
              this.plugin.settings.mainColourHue,
              this.plugin.settings.mainColourSat,
              value
            );
          })
      );

    new Setting(containerEl)
      .setName("Background colour hue")
      .setDesc("Hue of the background colour")
      .addSlider((slider) =>
        slider
          .setLimits(0, 360, 1)
          .setValue(this.plugin.settings.backgroundColourHue)
          .onChange((value) => {
            console.log(value);
            this.plugin.settings.backgroundColourHue = value;
            this.plugin.saveData(this.plugin.settings);
            backgroundColourPicker.value = hslToHex(
              value,
              this.plugin.settings.backgroundColourSat,
              this.plugin.settings.backgroundColourLight
            );
          })
      );

    new Setting(containerEl)
      .setName("Background colour saturation")
      .setDesc("Saturation of the background colour")
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 1)
          .setValue(this.plugin.settings.backgroundColourSat)
          .onChange((value) => {
            this.plugin.settings.backgroundColourSat = value;
            this.plugin.saveData(this.plugin.settings);
            backgroundColourPicker.value = hslToHex(
              this.plugin.settings.backgroundColourHue,
              value,
              this.plugin.settings.backgroundColourLight
            );
          })
      );

    new Setting(containerEl)
      .setName("Background colour light")
      .setDesc("Light of the background colour")
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 1)
          .setValue(this.plugin.settings.backgroundColourLight)
          .onChange((value) => {
            this.plugin.settings.backgroundColourLight = value;
            this.plugin.saveData(this.plugin.settings);
            backgroundColourPicker.value = hslToHex(
              this.plugin.settings.backgroundColourHue,
              this.plugin.settings.backgroundColourSat,
              value
            );
          })
      );
  }
}
