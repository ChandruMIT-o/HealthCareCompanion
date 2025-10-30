
import { BasePlot } from './BasePlot.js';

export class EcgPlot extends BasePlot {
    constructor() {
        super('ecg'); // Matches canvas ID 'ecg-chart'
    }
}
