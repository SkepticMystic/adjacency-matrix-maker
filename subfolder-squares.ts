import { App } from "obsidian";

class MyPlugin extends Plugin {
  app: App;
  onLoad() {
    let files = this.app.vault.getMarkdownFiles();
    let paths = files.map((file) => file.path);

    // This:
    /// - drops the filename.md at the end
    /// - Accounts for files in root of vault, changes them to '/'
    let fullFolders = paths.map((path) =>
      path.match(/(.+)\//) ? path.match(/(.+)\//)[1] : "/"
    );

    interface ChangeItem {
      fileNo: number;
      nextDesc: string;
      curLevel: number;
      deltaLevel: number;
    }

    interface ChangeItemArr extends Array<ChangeItem> {}

    // Just keep in mind that changeArr is one item less than files.length
    /// There is enough information to tell what happens with the last file, but just keep this in mind

    let changeArr: ChangeItemArr = [];
    for (let i = 0; i < fullFolders.length - 1; i++) {
      const currentFolder =
        fullFolders[i] === "/" ? "@@UNIQUE_ROOT" : fullFolders[i] + "/";
      const nextFolder =
        fullFolders[i + 1] === "/" ? "@@UNIQUE_ROOT" : fullFolders[i + 1] + "/";
      const currentLevel = (currentFolder.match(/\//g) || []).length;
      const nextLevel = (nextFolder.match(/\//g) || []).length;

      if (currentFolder === nextFolder) {
        changeArr.push({
          fileNo: i,
          nextDesc: "same",
          curLevel: currentLevel,
          deltaLevel: nextLevel - currentLevel,
        });
      } else if (currentFolder.includes(nextFolder)) {
        changeArr.push({
          fileNo: i,
          nextDesc: "shallower",
          curLevel: currentLevel,
          deltaLevel: nextLevel - currentLevel,
        });
      } else if (nextFolder.includes(currentFolder)) {
        changeArr.push({
          fileNo: i,
          nextDesc: "deeper",
          curLevel: currentLevel,
          deltaLevel: nextLevel - currentLevel,
        });
      } else {
        changeArr.push({
          fileNo: i,
          nextDesc: "different",
          curLevel: currentLevel,
          deltaLevel: nextLevel - currentLevel,
        });
      }
    }


    let changeIndices = 

    // let level1Squares = [];

    // changeArr.forEach((change, i) => {
    //   while (change.curLevel >= 1 && change.nextDesc !== "different") {
    //     level1Squares.push();
    //   }
    // });

    /// Different approach:

    let firstAndSubPaths = paths.map((path) => {
      const firstFolder = path.match(/[^\/]+/)[0];
      const allFolders = path.match(/(.+)\//) ? path.match(/(.+)\//)[1] : "/";
      return {
        firstFolder,
        allFolders,
      };
    });

    function groupBy(xs: {}[], key: string) {
      return xs.reduce(function (rv, x) {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
      }, {});
    }

    let grouped = groupBy(firstAndSubPaths, "firstFolder");
    // console.log(grouped);

    function indicesOfChange(arr: []) {
      const newValueAt = [0];
      for (let i = 1; i < arr.length; i++) {
        if (arr[i] !== arr[i - 1]) {
          newValueAt.push(i);
        }
      }
    }

    let groupedArr = Object.values(grouped);
    let groupedSubfoldersArr: string[][] = groupedArr.map((arr: []) => {
      return arr.map((obj: {}) => obj.allFolders);
    });

    let nestLevelInfo = groupedSubfoldersArr.map((arr) => {
      return arr.map((str) => {
        return (str.match(/\//g) || []).length;
      });
    });
  }
}
