export class Analyser {
  private analyser: AnalyserNode;
  bufferLength = 0;
  private dataArrayInternal: Uint8Array;

  constructor(node: AudioNode, fftSizeUser?: number) {
    this.analyser = node.context.createAnalyser();
    node.connect(this.analyser);
    this.analyser.fftSize = fftSizeUser || 32;
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArrayInternal = new Uint8Array(this.bufferLength);
  }

  update() {
    this.analyser.getByteFrequencyData(this.dataArrayInternal as any);
  }

  get data() {
    return this.dataArrayInternal;
  }
}