import {
  addIcon,
  App,
  debounce,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
  TAbstractFile,
  Workspace,
  WorkspaceLeaf,
  parseFrontMatterEntry,
  normalizePath,
} from "obsidian";
import {
  normalise,
  sumRows,
  convertDataURIToBinary,
  hslToHex,
  hexToHSL,
} from "./utility";
interface AdjacencyMatrixMakerPluginSettings {
  mainColourComponents: [number, number, number];
  backgroundColour: string;
  imgName: string;
  folderPath: string;
  showFolders: boolean;
  folderSquaresColour: string;
}

const DEFAULT_SETTINGS: AdjacencyMatrixMakerPluginSettings = {
  mainColourComponents: [202, 72, 44],
  backgroundColour: "#141414",
  imgName: "adj",
  folderPath: "/",
  showFolders: true,
  folderSquaresColour: "#ffffff",
};

function validFolderPathQ(path: string) {
  const file: TAbstractFile = app.vault.getAbstractFileByPath(path);
  return file && file instanceof TFolder;
}

//? Show subfolder squares
interface square {
  depth: number;
  start: number;
  end: number;
}

interface cutPath {
  file: number;
  cutPath: string;
}

function cutAtDepth(paths: string[], depth: number) {
  const splitPaths = paths.map((path) => path.split("/").slice(1, -1));
  const cutPaths: cutPath[] = splitPaths.map((path, i) => {
    return path.length >= depth
      ? {
          file: i,
          cutPath: path.slice(0, depth).join("/"),
        }
      : null;
  });

  return cutPaths.filter((item) => item !== null);
}

function squaresAtN(cutPaths: cutPath[], depth: number) {
  const squares: square[] = [];
  let start = cutPaths[0].file;

  for (let i = 1; i < cutPaths.length - 1; i++) {
    const prev = cutPaths[i - 1].cutPath;
    const curr = cutPaths[i].cutPath;
    const next = cutPaths[i + 1].cutPath;

    if (prev !== curr) {
      start = cutPaths[i].file;
    }

    if (curr !== next) {
      squares.push({ depth, start, end: cutPaths[i].file });
    }
  }

  return squares;
}

function allSquares(files: TFile[]) {
  const paths = files.map((file) => file.path);

  // This drops the filename.md at the end, and accounts for files in root of vault, changes them to '/'
  const fullFolders = paths.map((path) =>
    path.match(/(.+)\//) ? "/" + path.match(/(.+)\//)[1] + "/" : "/"
  );

  const maxDepth = Math.max(
    ...fullFolders.map((path) => path.split("/").length - 2)
  );

  const allSquaresArr: square[][] = [];
  for (let i = 1; i <= maxDepth; i++) {
    allSquaresArr.push(squaresAtN(cutAtDepth(fullFolders, i), i));
  }
  return allSquaresArr;
}

//? End show subfolder squares

async function drawAdjAsImage(
  scale: number,
  alphas: number[],
  adjArray: number[][],
  canvas: HTMLCanvasElement,
  settings: AdjacencyMatrixMakerPluginSettings,
  // folderChangeIndices: number[],
  files: TFile[]
) {
  const ctx = canvas.getContext("2d");
  const size = alphas.length;
  canvas.width = size * scale;
  canvas.height = canvas.height;

  const mnComp = settings.mainColourComponents;
  const bgColour = settings.backgroundColour;

  for (let i = 0; i < size; i++) {
    // Where the alpha of that row is proportional to the number of coloured cells in that row
    /// Make the more "popular" notes pop
    const alpha = alphas[i] / 1.2 + 0.166666666666;

    for (let j = 0; j < size; j++) {
      // Position of the top-left corner of the next pixel
      const x = i * scale;
      const y = j * scale;
      let cellColour: string;

      // Change colour if the two notes are linked
      if (adjArray[i][j] === 0) {
        cellColour = bgColour;
      } else {
        cellColour = `hsla(${mnComp[0]}, ${mnComp[1]}%, ${mnComp[2]}%, ${alpha})`;
      }

      // Draw the cell
      ctx.beginPath();
      ctx.fillStyle = cellColour;
      ctx.fillRect(x, y, scale, scale);
    }
  }

  if (settings.showFolders) {
    const squareArrs = allSquares(files);
    squareArrs.forEach((squareArr, i) => {
      if (squareArr[i]) {
        switch (squareArr[i].depth) {
          case 1:
            ctx.strokeStyle = "red";
            break;
          case 2:
            ctx.strokeStyle = "orange";
            break;
          case 3:
            ctx.strokeStyle = "yellow";
            break;
          case 4:
            ctx.strokeStyle = "green";
            break;
          case 5:
            ctx.strokeStyle = "blue";
            break;
          case 6:
            ctx.strokeStyle = "indigo";
            break;
          case 7:
            ctx.strokeStyle = "purple";
            break;

          default:
            ctx.strokeStyle = "white";
            break;
        }

        squareArr.forEach((square) => {
          const start = square.start * scale;
          const sideLength = (square.end - square.start + 1) * scale;
          ctx.strokeRect(start, start, sideLength, sideLength);
        });
      }
    });

    // Last squares
    //! allSquares doesn't give the last square for each depth
    //   const lastSquares = squareArrs.map((squareArr) => squareArr.last());
    //   lastSquares.forEach((square, i) => {
    //     if (square) {
    //       switch (square.depth) {
    //         case 1:
    //           ctx.strokeStyle = "red";
    //           break;
    //         case 2:
    //           ctx.strokeStyle = "orange";
    //           break;
    //         case 3:
    //           ctx.strokeStyle = "yellow";
    //           break;
    //         case 4:
    //           ctx.strokeStyle = "green";
    //           break;
    //         case 5:
    //           ctx.strokeStyle = "blue";
    //           break;
    //         case 6:
    //           ctx.strokeStyle = "indigo";
    //           break;
    //         case 7:
    //           ctx.strokeStyle = "purple";
    //           break;

    //         default:
    //           ctx.strokeStyle = "red";
    //           break;
    //       }
    //       const lastStart = (square.end + 1) * scale;
    //       const lastSideLength = canvas.width - lastStart;
    //       console.log({
    //         start: lastStart / scale,
    //         length: lastSideLength / scale,
    //       });
    //       ctx.strokeRect(lastStart, lastStart, lastSideLength, lastSideLength);
    //     }
    //   });
  }

  // Add the folder squares if enabled
  // if (settings.showFolders) {
  //   folderChangeIndices.forEach((change, i) => {
  //     ctx.strokeStyle = settings.folderSquaresColour;
  //     const start = change * scale;
  //     const sideLength = (folderChangeIndices[i + 1] - change) * scale;
  //     ctx.strokeRect(start, start, sideLength, sideLength);
  //   });

  //   // For the last square
  //   const lastStart = folderChangeIndices.last() * scale;
  //   const lastSideLength = canvas.width - lastStart;
  //   ctx.strokeRect(lastStart, lastStart, lastSideLength, lastSideLength);
  // }

  const img = new Image();
  img.src = canvas.toDataURL("image/svg");
  return img;
}

function indexOfFolderChanges(files: TFile[]) {
  // Get the first-level folder of all files
  const firstFolders = files
    .map((file) => file.path.match(/[^\/]+/)[0])
    .map((firstFolder) => (firstFolder.includes(".md") ? "/" : firstFolder));

  // Mark the index at which a new run/streak starts
  return [...new Set(firstFolders)].map((item) => firstFolders.indexOf(item));
}

export default class AdjacencyMatrixMakerPlugin extends Plugin {
  settings: AdjacencyMatrixMakerPluginSettings;

  async onload() {
    console.log("Loading Adjacency Matrix Maker plugin");

    await this.loadSettings();

    addIcon(
      "matrix",
      `<path fill="currentColor" stroke="currentColor" d="M8,8v84h84v-6H80V74h-6V62h6v-6H68V44H38V32h6v-6h12v6h-6v6h12v-6h18V20h12v-6h-6V8h-6v6h-6V8h-6v6h-6V8h-6v12h-6V8h-6v12 h-6v6h-6v12H20v6h12v6h-6v6h12v-6h24v24h6v6h6v6H62V74h-6v6H44v6h-6v-6H26v6H14V38h6V20h-6V8L8,8z M20,20h6V8h-6V20z M56,74v-6h-6 v6H56z M26,56h-6v6h6V56z M68,44h6v6h6v6h12v-6h-6v-6h6v-6H68L68,44z M80,62v12h6v-6h6v-6H80z M86,74v6h6v-6H86z M32,8v6h6V8L32,8 z M62,20h6v6h-6V20z M86,26v6h6v-6H86z M50,56v6h6v-6H50z M38,62v6h-6v6h12V62H38z M20,68v6h6v-6H20z"/>`
    );
    this.addRibbonIcon("matrix", "Adjacency Matrix", this.makeAdjacencyMatrix);

    this.addRibbonIcon("dice", "Normalize Path", () => {
      console.log(normalizePath("/"));
    });

    this.addCommand({
      id: "adjacency-matrix",
      name: "Open Adjacency Matrix",
      callback: this.makeAdjacencyMatrix,
    });

    this.addSettingTab(new AdjacencyMatrixMakerSettingTab(this.app, this));
  }

  // Does `from` have a link going to `to`?
  linkedQ(from: TFile, to: TFile) {
    return this.app.metadataCache.resolvedLinks[from.path]?.hasOwnProperty(
      to.path
    );
  }

  populateAdjacencyMatrixArr(files: TFile[]) {
    const size = files.length;
    const adjArray: number[][] = [];

    for (let i = 0; i < size; i++) {
      adjArray.push([]);
      for (let j = 0; j < size; j++) {
        // 1 or 0 so that sumRows works (instead of true or false)
        /// Todo: I think I can just use the link count here, nothing else to do
        adjArray[i][j] = this.linkedQ(files[i], files[j]) ? 1 : 0;
      }
    }
    return adjArray;
  }

  makeAdjacencyMatrix = async () => {
    const files: TFile[] = this.app.vault.getMarkdownFiles();
    const size = files.length;

    // Todo: should just be able to slot in a check for settings.userScale ? settings.userScale : ...
    const scale = size < 50 ? 16 : size < 100 ? 8 : size < 200 ? 4 : 2;

    // Canvas setup
    const canvas = document.createElement("canvas");
    canvas.width = size * scale;
    canvas.height = size * scale;

    const adjArray = this.populateAdjacencyMatrixArr(files);
    const alphas = normalise(sumRows(adjArray));

    // Determine where folder changes
    const folderChangeIndices = this.settings.showFolders
      ? indexOfFolderChanges(files)
      : [];

    const img = await drawAdjAsImage(
      scale,
      alphas,
      adjArray,
      canvas,
      this.settings,
      files
    );

    new MatrixModal(
      this.app,
      img,
      files,
      scale,
      adjArray,
      this.settings
    ).open();
  };

  onunload() {
    console.log("unloading adjacency matrix maker plugin");
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
  private files: TFile[];
  private scale: number;
  private adjArray: number[][];
  private settings: AdjacencyMatrixMakerPluginSettings;

  constructor(
    app: App,
    img: HTMLImageElement,
    files: TFile[],
    scale: number,
    adjArray: number[][],
    settings: AdjacencyMatrixMakerPluginSettings
  ) {
    super(app);
    this.img = img;
    this.files = files;
    this.scale = scale;
    this.adjArray = adjArray;
    this.settings = settings;
  }

  interval: NodeJS.Timeout;

  onOpen() {
    const modal = this;
    const app = this.app;
    const img = this.img;
    const scale = this.scale;
    const files = this.files;
    const adjArray = this.adjArray;
    const settings = this.settings;

    // Add the canvas to the modal
    let { contentEl } = this;

    contentEl.style.height = `${Math.round(screen.height / 1.5)}px`;

    const vaultName: string = app.vault.getName();
    contentEl.createEl("h2", { text: `Adjacency matrix of: ${vaultName}` });

    const buttonRow = contentEl.createDiv({ cls: "matrixModalButtons" });

    const canvas = contentEl.createEl("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");

    // Save image button
    const saveImageButton = buttonRow.createEl("button", {
      text: "Save Image",
    });
    const resetScaleButton = buttonRow.createEl("button", {
      text: "Reset Scale",
    });

    // Tooltip
    const tooltip = contentEl.createDiv({ cls: "adj-tooltip" });
    const tooltipText = tooltip.createSpan({ cls: "adj-tooltip-text" });

    ////// Zoom & Pan code /////////
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
      rx: 0,
      ry: 0,
      oldX: 0,
      oldY: 0,
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
    }

    function setupMouse(e: HTMLElement) {
      e.addEventListener("mousemove", mouseMove);
      e.addEventListener("mousedown", mouseMove);
      e.addEventListener("mouseup", mouseMove);
      e.addEventListener("mouseout", mouseMove);
      e.addEventListener("mouseover", mouseMove);
      e.addEventListener("mousewheel", mouseMove);
      e.addEventListener(
        "contextmenu",
        function (e) {
          e.preventDefault();
        },
        false
      );
    }
    setupMouse(canvas);

    const initialScale = Math.min(
      1 / (img.width / contentEl.clientWidth),
      1 / (img.height / contentEl.clientHeight)
    );
    // Real space, real, r (prefix) refers to the transformed canvas space.
    // c (prefix), chase is the value that chases a requiered value
    var displayTransform = {
      x: 0,
      y: 0,
      ox: 0,
      oy: 0,
      scale: initialScale,
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
      updateValues: function () {
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
        this.matrix[0] = this.cscale;
        // this.matrix[1] = Math.sin(this.crotate) * this.cscale;
        // this.matrix[2] = -this.matrix[1];
        this.matrix[3] = this.matrix[0];

        // set the coords relative to the origin
        this.matrix[4] =
          -(this.cx * this.matrix[0] + this.cy * this.matrix[2]) + this.cox;
        this.matrix[5] =
          -(this.cx * this.matrix[1] + this.cy * this.matrix[3]) + this.coy;

        // create invers matrix
        let det = this.matrix[0] * this.matrix[3];
        this.invMatrix[0] = this.matrix[3] / det;
        // this.invMatrix[1] = -this.matrix[1] / det;
        // this.invMatrix[2] = -this.matrix[2] / det;
        this.invMatrix[3] = this.matrix[0] / det;

        // check for mouse. Do controls and get real position of mouse.
        if (mouse !== undefined) {
          // if there is a mouse get the real cavas coordinates of the mouse
          if (mouse.oldX !== undefined && (mouse.buttonRaw & 1) === 1) {
            // check if panning (middle button)
            var mdx = mouse.x - mouse.oldX; // get the mouse movement
            var mdy = mouse.y - mouse.oldY;
            // get the movement in real space
            var mrx = mdx * this.invMatrix[0]; // + mdy * this.invMatrix[2];
            var mry = mdy * this.invMatrix[3]; // + mdx * this.invMatrix[1]
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
            this.cox = mouse.x;
            this.coy = mouse.y;
            this.cx = this.mouseX;
            this.cy = this.mouseY;
            */

            if (mouse.w > 0) {
              // zoom in
              this.scale *= 1.15;
              mouse.w -= 20;
              if (mouse.w < 0) {
                mouse.w = 0;
              }
            }
            if (mouse.w < 0) {
              // zoom out
              this.scale *= 1 / 1.15;
              mouse.w += 20;
              if (mouse.w > 0) {
                mouse.w = 0;
              }
            }
          }
          // get the real mouse position
          var screenX = mouse.x - this.cox;
          var screenY = mouse.y - this.coy;
          this.mouseX = this.cx + screenX * this.invMatrix[0]; // + screenY * this.invMatrix[2]
          this.mouseY = this.cy + screenY * this.invMatrix[3]; //screenX * this.invMatrix[1] +
          mouse.rx = this.mouseX; // add the coordinates to the mouse. r is for real
          mouse.ry = this.mouseY;
          // save old mouse position
          mouse.oldX = mouse.x;
          mouse.oldY = mouse.y;
        }
      },
    };

    function update() {
      // console.count("updating");
      // update the transform
      displayTransform.updateValues();
      // set home transform to clear the screem
      displayTransform.setHome();

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      displayTransform.setTransform();
      ctx.drawImage(img, 0, 0);

      if (mouse.buttonRaw === 4) {
        // right click to return to home
        // displayTransform.x = 0;
        // displayTransform.y = 0;
        // displayTransform.scale = 1;
        // displayTransform.rotate = 0;
        // displayTransform.ox = 0;
        // displayTransform.oy = 0;
        displayTransform.scale = initialScale;
      }
    }

    // update();
    this.interval = setInterval(update, 25);

    function handleTooltip(e: MouseEvent) {
      const x = e.offsetX;
      const y = e.offsetY;

      // Todo check that the mouse is inside the canvas first
      const realx = mouse.rx;
      const realy = mouse.ry;

      // Convert coord to cell number
      const i = Math.round(realx / scale - 0.5);
      const j = Math.round(realy / scale - 0.5);

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

    canvas.addEventListener("mousemove", debounce(handleTooltip, 25, true));

    async function openClickedCellAsFile() {
      const realx = mouse.rx;
      const realy = mouse.ry;

      // Convert coord to cell number
      const i = Math.round(realx / scale - 0.5);
      const j = Math.round(realy / scale - 0.5);

      // Pick the file that cell refers to (the `from` value)
      const fileI = files[i];

      if (adjArray[i][j] === 1) {
        // Open the clicked cell (from, not to) in the active leaf
        await app.workspace.activeLeaf.openFile(fileI);
        modal.close();
      }
    }

    canvas.addEventListener("click", openClickedCellAsFile);

    resetScaleButton.addEventListener("click", () => {
      displayTransform.scale = initialScale;
    });

    function saveCanvasAsImage() {
      const arrBuff = convertDataURIToBinary(img.src);

      // Add the current datetime to the image name
      const now = window.moment().format("YYYYMMDD HHmmss");

      // Image name from settings
      const imgName = settings.imgName;

      // Folder path to save img
      const folderPath = settings.folderPath === "" ? "/" : settings.folderPath;

      if (validFolderPathQ(folderPath)) {
        app.vault.createBinary(`${folderPath}/${imgName} ${now}.png`, arrBuff);
        new Notice("Image saved");
      } else {
        new Notice("Chosen folder path does not exist in your vault");
      }
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

    // Folder squares colour picker
    const folderSquaresColourDiv = coloursDiv.createDiv();
    folderSquaresColourDiv.createEl("h4", {
      text: "Folder squares colour",
    });
    const folderSquaresColourPicker = folderSquaresColourDiv.createEl("input", {
      type: "color",
    });

    folderSquaresColourPicker.value = this.plugin.settings.folderSquaresColour;
    folderSquaresColourPicker.addEventListener("change", async () => {
      this.plugin.settings.folderSquaresColour =
        folderSquaresColourPicker.value;
      await this.plugin.saveSettings();
    });

    new Setting(containerEl)
      .setName("Show folders")
      .setDesc("Add squares to the image showing which folder a note is in")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showFolders)
          .onChange(async (value) => {
            this.plugin.settings.showFolders = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Image name")
      .setDesc(
        "The value used to name a saved image. The name will have the datetime appended automatically"
      )
      .addText((text) =>
        text
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
      .addText((text) =>
        text
          .setPlaceholder("/")
          .setValue(this.plugin.settings.folderPath)
          .onChange(async (value) => {
            this.plugin.settings.folderPath = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
