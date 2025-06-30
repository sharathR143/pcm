<template>
  <PcmUploader />
</template>

<script>
import PcmUploader from "./components/PcmUploader.vue";

export default {
  name: "App",
  components: {
    PcmUploader,
  },
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
