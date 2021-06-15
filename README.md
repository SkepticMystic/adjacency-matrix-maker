# Adjacency Matrix Maker

An adjacency matrix is a different way to represent an Obsidian graph.

It starts with a square grid of cells, where each **row** of cells represents a single note in your vault, and so does each **column**.
If note `i` is linked to note `j`, then the cell in row `i` and column `j` will be coloured in.

You can think of it as a grid of all the **links** in your vault.
Each row is a _node_ in your graph, and each cell is an _edge_.

## Examples

This graph conveys the same information as this adjacency matrix:

![](https://i.imgur.com/VZuvAhq.png)


![](https://i.imgur.com/glL4mGc.png)


## Functionality

### Pan & Zoom

When you run the `Make Adjacency Matrix` command, you will see a modal pop up with an image of your matrix. This can be panned (by holding down left-click and dragging), and zoomed (using the middle mouse wheel).
If you want to reset the zoom level to it's initial state, you can use the right mouse btton, or click the `Reset Scale` button above the image.

![](https://i.imgur.com/iJohDDi.png)

### Interactive Tooltip

If you hoiver your cursor over a coloured-in cell (representing two linked notes), you will see a tooltip appear showing which two notes are linked `A → B`

![](https://i.imgur.com/wu6ivE7.png)

You can hold down `Ctrl` to see this tooltip anywhere, even if the two notes aren't linked.

If you click on a cell, it will open the note with the outgoing link (Note `A`).

### Folder Squares

There is an option to show "folder squares" on the image of your adjacency matrix. These squares show which folder each note is in. You can also see subfolders based on colours:

- Level-1 folders → **Red**
- Level-2 folders → **Orange**
- Level-3 folders → **Yellow**
- Level-4 folders → **Green**
- Level-5 folders → **Blue**
- Level-6 folders → **Indigo**
- Level-7 folders → **Violet**

![](https://i.imgur.com/R7xGlb4.png)

### Save Image

You can save the image of the adjacency matrix to your vault by clicking on the `Save Image` button. If successful, you will see a notice appear in the top-right corner saying `Image Saved`.
The defualt name and path of the image can be configured in [image settings](README.md#save-image-configuration)

## Settings

There are a few settings you can change. These can be found under the settings tab for the plugin.

### Colours

You can change the main and background colour of the image. The main colour is used to colour-in cells when two notes are linked. The background colour fills in the rest of the cells.

These settings:

![](https://i.imgur.com/gF0G9Zs.png)

give me this matrix:

![](https://i.imgur.com/4u6xgO6.png)


### Show Folders

There is also the option to toggle [folder squares](README.md#folder-squares) on or off.

![](https://i.imgur.com/pEWm964.png)


### Image Scale

Using the `Image Scale` option, you can change how detialed the image is. A higher scale means longer waiting time, but also a crisper image. 
By default, the scale is chosen based on the size of your vault.

#### `Image scale = 1`

![](https://i.imgur.com/0fu419R.png)

#### `Image Scale = 100`

![](https://i.imgur.com/1gRD7hV.png)

### Save Image Configuration

When saving the image to your vault, you can change the following properties.

#### Image Name

The name prepended to the current datetime.
For example, if `Image Name = Adj`, then the saved image will be called `Adj 2021-06-15 2223`. 

#### Image Path

You can also choose where the image is saved. By default, it is saved to the root of your vault. 
To change it, just write the path to the folder youw ant it to be saved in.
For example, `Image path = Attachments/Images/Adjacency Matrices`.