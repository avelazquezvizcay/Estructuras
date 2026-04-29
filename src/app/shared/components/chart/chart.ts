import { ChangeDetectionStrategy, Component, ElementRef, Input, ViewChild, afterNextRender, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'sec-chart',
  standalone: true,
  template: `<div class="chart-container"><canvas #chartCanvas></canvas></div>`,
  styles: [`
    .chart-container { position: relative; width: 100%; height: 300px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChartComponent implements OnDestroy, OnChanges {
  @ViewChild('chartCanvas') private chartCanvas!: ElementRef<HTMLCanvasElement>;
  
  @Input() config!: ChartConfiguration;
  
  private chart?: Chart;

  constructor() {
    afterNextRender(() => {
      this.createChart();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && this.chart) {
      this.chart.destroy();
      this.createChart();
    }
  }

  private createChart(): void {
    if (!this.chartCanvas) return;
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (ctx) {
      this.chart = new Chart(ctx, this.config);
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
