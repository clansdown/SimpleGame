<script lang="ts">
    import { onMount } from "svelte";
    import { initEngine } from "./lib/simplegame";


  let canvas: HTMLCanvasElement;
  let debug: HTMLDivElement;

  onMount(() => {
    initEngine(canvas, debug);
  });

</script>

<main style="width: 100%; height: 100%;">
  <div class="canvas" >
    <canvas bind:this={canvas} contentEditable="true" width={1000} height={1000} style="width: 100%; height: 100%;"></canvas>
  </div>

  <div style="color: #fff; 1px solid #fff; margin: 1em; border: 1em;" bind:this={debug}>Debug text goes here</div>
</main>

<style>
  div.canvas {
    width: 100%;
    height: 100%;
  }
  canvas {
    width: 100%;
    height: 100%;
  }

</style>
