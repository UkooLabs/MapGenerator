import * as log from 'loglevel';
import * as dat from 'dat.gui';
import TensorFieldGUI from './ts/ui/tensor_field_gui';
import {NoiseParams} from './ts/impl/tensor_field';
import MainGUI from './ts/ui/main_gui';
import CanvasWrapper from './ts/ui/canvas_wrapper';
import {DefaultCanvasWrapper, RoughCanvasWrapper} from './ts/ui/canvas_wrapper';
import Util from './ts/util';
import DragController from './ts/ui/drag_controller';
import DomainController from './ts/ui/domain_controller';
import Style from './ts/ui/style';
import {ColourScheme, DefaultStyle, RoughStyle} from './ts/ui/style';
import * as ColourSchemes from './colour_schemes.json';
import Vector from './ts/vector';

class Main {
    private domainController = DomainController.getInstance();
    private gui: dat.GUI = new dat.GUI({width: 300});
    private tensorField: TensorFieldGUI;
    private mainGui: MainGUI;
    private dragController = new DragController(this.gui);

    // Options
    private imageScale = 3;

    // Folders
    private tensorFolder: dat.GUI;
    private roadsFolder: dat.GUI;

    // To force draw if needed
    private previousFrameDrawTensor = true;

    private canvas: HTMLCanvasElement;
    private tensorCanvas: DefaultCanvasWrapper;
    private _style: Style;
    private styleFolder: dat.GUI;
    private colourScheme: string = "GoogleNoZoom";
    private zoomBuildings: boolean = false;
    private buildingModels: boolean = false;
    private showFrame: boolean = false;
    public highDPI = false;

    constructor() {
        this.canvas = document.getElementById(Util.CANVAS_ID) as HTMLCanvasElement;
        this.tensorCanvas = new DefaultCanvasWrapper(this.canvas);

        const zoomController = this.gui.add(this.domainController, 'zoom');
        this.gui.add(this, 'generate');
        this.domainController.setZoomUpdate(() => zoomController.updateDisplay());
        
        // Style
        this.styleFolder = this.gui.addFolder('Style');
        this.styleFolder.add(this, 'colourScheme', Object.keys(ColourSchemes)).onChange((val: string) => this.changeColourScheme(val));

        const noiseParams: NoiseParams = {
            globalNoise: false,
            noiseSizePark: 20,
            noiseAnglePark: 90,
            noiseSizeGlobal: 30,
            noiseAngleGlobal: 20
        };

        this.tensorFolder = this.gui.addFolder('Tensor Field');
        this.tensorField = new TensorFieldGUI(this.tensorFolder, this.dragController, true, noiseParams);
        this.roadsFolder = this.gui.addFolder('Map');
        this.mainGui = new MainGUI(this.roadsFolder, this.tensorField, () => this.tensorFolder.close());

        const optionsFolder = this.gui.addFolder('Options');
        optionsFolder.add(this.tensorField, 'drawCentre');
        const canvasScaleController = optionsFolder.add(this, 'highDPI');
        canvasScaleController.onChange((high: boolean) => this.changeCanvasScale(high));
        optionsFolder.add(this, 'imageScale', 1, 5).step(1);
        optionsFolder.add(this, 'download');
        
        this.styleFolder.add(this, 'zoomBuildings').onChange((val: boolean) => {
            if (this._style instanceof DefaultStyle) {
                // Force redraw
                this.previousFrameDrawTensor = true;
                this._style.zoomBuildings = val;
            }
        });

        this.styleFolder.add(this, 'buildingModels').onChange((val: boolean) => {
            if (this._style instanceof DefaultStyle) {
                // Force redraw
                this.previousFrameDrawTensor = true;
                this._style.showBuildingModels = val;
            }
        });
        
        this.styleFolder.add(this, 'showFrame').onChange((val: boolean) => {
            this.previousFrameDrawTensor = true;
            this._style.showFrame = val;
        });

        this.changeColourScheme(this.colourScheme);

        this.tensorField.setRecommended();

        requestAnimationFrame(this.update.bind(this));
    }

    generate() {
        this.tensorField.setRecommended();
        this.mainGui.generateEverything();
    }



    changeColourScheme(scheme: string) {
        if (scheme === "Drawn") {
            this._style = new RoughStyle(this.canvas);
        } else {
            const colourScheme: ColourScheme = (ColourSchemes as any)[scheme];
            this.zoomBuildings = colourScheme.zoomBuildings;
            this.buildingModels = colourScheme.buildingModels;
            Util.updateGui(this.styleFolder);
            this._style = new DefaultStyle(this.canvas, Object.assign({}, colourScheme));
        }
        this._style.showFrame = this.showFrame;
        this.changeCanvasScale(this.highDPI);
    }

    changeCanvasScale(high: boolean): void {
        const value = high ? 2 : 1;
        this._style.canvasScale = value;
        this.tensorCanvas.canvasScale = value;
    }

    /**
     * Downloads image of map
     * Draws onto hidden canvas at requested resolution
     */
    download(): void {
        const c = document.getElementById(Util.IMG_CANVAS_ID) as HTMLCanvasElement;

        // Draw
        if (this.showTensorField()) {
            this.tensorField.draw(new DefaultCanvasWrapper(c, this.imageScale, false));
        } else {            
            const imgCanvas = this._style.createCanvasWrapper(c, this.imageScale, false);
            this.mainGui.draw(this._style, true, imgCanvas);
        }

        const link = document.createElement('a');
        link.download = 'map.png';
        link.href = (document.getElementById(Util.IMG_CANVAS_ID) as any).toDataURL();
        link.click();
    }

    private showTensorField(): boolean {
        return !this.tensorFolder.closed || this.mainGui.roadsEmpty();
    }

    draw(): void {
        if (this.showTensorField()) {
            this.previousFrameDrawTensor = true;
            this.dragController.setDragDisabled(false);
            this.tensorField.draw(this.tensorCanvas);
        } else {
            // Disable field drag and drop
            this.dragController.setDragDisabled(true);
            
            if (this.previousFrameDrawTensor === true) {
                this.previousFrameDrawTensor = false;

                // Force redraw if switching from tensor field
                this.mainGui.draw(this._style, true);
            } else {
                this.mainGui.draw(this._style);
            }
        }
    }

    update(): void {
        this.mainGui.update();
        this.draw();
        requestAnimationFrame(this.update.bind(this));
    }
}

(window as any).log = log;
window.addEventListener('load', (): void => {
    new Main();
});
