import { Component, ElementRef, OnInit, ViewChild, signal, WritableSignal, Signal } from '@angular/core';
import { MapService, Planet, LayerItem } from '../services/map.service';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, TitleCasePipe, FormsModule, DragDropModule],
  templateUrl: './map.component.html'
})
export class MapComponent implements OnInit {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('scaleContainer', { static: true }) scaleContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('terminalInput', { static: true }) terminalInput!: ElementRef<HTMLInputElement>;

  /** Modal and form state */
  isModalOpen: WritableSignal<boolean> = signal(false);
  modalMode: WritableSignal<'add' | 'edit'> = signal('add');
  newLayer: WritableSignal<Partial<LayerItem>> = signal({});

  /** Expose current planet and layers */
  currentPlanet!: Signal<Planet>;
  visibleLayers!: Signal<LayerItem[]>;
  planets: Planet[] = ['earth', 'mars', 'moon'];

  constructor(public mapService: MapService) { }

  ngOnInit(): void {
    // Initialize the OpenLayers map
    this.mapService.initMap(this.mapContainer.nativeElement, this.scaleContainer.nativeElement);
    this.currentPlanet = this.mapService.currentPlanet;
    this.visibleLayers = this.mapService.visibleLayers;
  }

  /** Planet switching */
  setPlanet(planet: Planet) {
    this.mapService.setPlanet(planet);
  }

  /** Open modal to add new layer */
  openAddLayerModal() {
    this.modalMode.set('add');
    this.newLayer.set({});
    this.isModalOpen.set(true);
  }

  /** Submit modal form */
  submitLayerModal() {
    if (this.modalMode() === 'add') {
      this.mapService.createManualLayer(this.newLayer());
    }
    this.isModalOpen.set(false);
  }

  /** Cancel modal */
  cancelModal() {
    this.isModalOpen.set(false);
  }

  /** Toggle a layer's visibility */
  toggleLayer(layer: LayerItem) {
    this.mapService.toggleLayer(layer);
  }

  /** Handle terminal input */
  handleTerminalCommand(event: Event) {
    this.mapService.handleTerminalCommand(event as KeyboardEvent);
  }

  /** Drag-drop reorder handler */
  onLayerDropped(event: CdkDragDrop<LayerItem[]>) {
    this.mapService.reorderLayers(event);
  }
  
}
