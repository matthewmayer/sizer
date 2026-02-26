const { createApp, ref, reactive, computed, watch, onMounted, onUnmounted } = Vue;

const PRESETS_STORAGE_KEY = "vue-image-resizer-presets";

createApp({
  setup() {
    const fileInput = ref(null);
    const canvas = ref(null);

    const isDragOver = ref(false);
    const imageLoaded = ref(false);

    const srcImage = ref(null);
    const srcWidth = ref(0);
    const srcHeight = ref(0);
    const srcName = ref("image");

    const targetWidth = ref(1200);
    const targetHeight = ref(628);
    const targetFormat = ref("image/png");
    const aspectMode = ref("fit"); // 'fit' | 'fill'
    const backgroundMode = ref("transparent"); // 'transparent' | 'color'
    const backgroundColor = ref("#ffffff");

    const isPickingColor = ref(false);

    const presetName = ref("");
    const presets = ref([]);

    const dpr = window.devicePixelRatio || 1;

    const canvasAspectStyle = computed(() => {
      const w = targetWidth.value || 1;
      const h = targetHeight.value || 1;
      return {
        width: `min(100%, 60vh * ${w}/${h})`,
        maxHeight: "60vh",
        aspectRatio: `${w}/${h}`,
      };
    });

    const formatLabel = (format) => {
      switch (format) {
        case "image/png":
          return "PNG";
        case "image/jpeg":
          return "JPG";
        case "image/webp":
          return "WEBP";
        default:
          return format;
      }
    };

    const clampDimension = (value) => {
      if (!Number.isFinite(value)) return 1;
      return Math.min(Math.max(Math.round(value), 1), 8000);
    };

    const loadPresets = () => {
      try {
        const raw = window.localStorage.getItem(PRESETS_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          presets.value = parsed;
        }
      } catch {
        // ignore parse errors
      }
    };

    const savePresetsToStorage = () => {
      try {
        window.localStorage.setItem(
          PRESETS_STORAGE_KEY,
          JSON.stringify(presets.value)
        );
      } catch {
        // ignore quota errors
      }
    };

    const onBrowseClick = () => {
      if (fileInput.value) {
        fileInput.value.value = "";
        fileInput.value.click();
      }
    };

    const handleFile = (file) => {
      if (!file || !file.type.startsWith("image/")) {
        return;
      }
      srcName.value = file.name || "image";

      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          srcImage.value = img;
          srcWidth.value = img.naturalWidth || img.width;
          srcHeight.value = img.naturalHeight || img.height;

          if (!targetWidth.value || !targetHeight.value) {
            targetWidth.value = clampDimension(srcWidth.value);
            targetHeight.value = clampDimension(srcHeight.value);
          }

          imageLoaded.value = true;
          isPickingColor.value = false;
          renderCanvas();
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    };

    const onFileChange = (event) => {
      const file = event.target.files && event.target.files[0];
      handleFile(file);
    };

    const onDragOver = () => {
      isDragOver.value = true;
    };

    const onDragLeave = () => {
      isDragOver.value = false;
    };

    const onDrop = (event) => {
      isDragOver.value = false;
      const file = event.dataTransfer && event.dataTransfer.files[0];
      handleFile(file);
    };

    const onPaste = (event) => {
      const dt = event.clipboardData;
      if (!dt) return;

      let file = null;
      if (dt.files && dt.files.length > 0 && dt.files[0].type && dt.files[0].type.toLowerCase().startsWith("image/")) {
        file = dt.files[0];
      }
      if (!file && dt.items) {
        for (let i = 0; i < dt.items.length; i++) {
          const item = dt.items[i];
          if (item.kind === "file" && item.type && item.type.toLowerCase().startsWith("image/")) {
            file = item.getAsFile();
            break;
          }
        }
      }
      if (file) {
        event.preventDefault();
        event.stopPropagation();
        srcName.value = "pasted-image";
        handleFile(file);
      }
    };

    const renderCanvas = (opts = {}) => {
      if (!canvas.value) return;

      const forExport = opts.forExport === true;
      const ctx = canvas.value.getContext("2d");
      const width = clampDimension(targetWidth.value || srcWidth.value || 1);
      const height = clampDimension(targetHeight.value || srcHeight.value || 1);

      targetWidth.value = width;
      targetHeight.value = height;

      canvas.value.width = width * dpr;
      canvas.value.height = height * dpr;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.clearRect(0, 0, width, height);

      if (backgroundMode.value === "color") {
        ctx.fillStyle = backgroundColor.value || "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }

      if (!srcImage.value) {
        return;
      }

      const sw = srcWidth.value || srcImage.value.width;
      const sh = srcHeight.value || srcImage.value.height;

      if (!sw || !sh) return;

      const scaleFit = Math.min(width / sw, height / sh);
      const scaleFill = Math.max(width / sw, height / sh);
      const scale = aspectMode.value === "fill" ? scaleFill : scaleFit;

      const drawWidth = sw * scale;
      const drawHeight = sh * scale;
      const offsetX = (width - drawWidth) / 2;
      const offsetY = (height - drawHeight) / 2;

      ctx.drawImage(srcImage.value, offsetX, offsetY, drawWidth, drawHeight);

      if (!forExport) {
        ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, width, height);
      }
    };

    const startEyedropper = () => {
      if (!imageLoaded.value) return;
      isPickingColor.value = true;
    };

    const canvasToImageCoords = (event) => {
      if (!canvas.value) return null;
      const rect = canvas.value.getBoundingClientRect();
      const cssX = event.clientX - rect.left;
      const cssY = event.clientY - rect.top;
      const internalX = (cssX * canvas.value.width) / rect.width;
      const internalY = (cssY * canvas.value.height) / rect.height;
      return {
        x: Math.floor(internalX),
        y: Math.floor(internalY),
      };
    };

    const rgbaToHex = (r, g, b) => {
      const toHex = (v) => v.toString(16).padStart(2, "0");
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    };

    const onCanvasClick = (event) => {
      if (!isPickingColor.value) return;
      if (!canvas.value) return;

      const ctx = canvas.value.getContext("2d");
      const coords = canvasToImageCoords(event);
      if (!coords) return;

      const { x, y } = coords;
      const imageData = ctx.getImageData(x, y, 1, 1).data;
      const [r, g, b] = imageData;
      const hex = rgbaToHex(r, g, b);

      backgroundColor.value = hex;
      backgroundMode.value = "color";
      isPickingColor.value = false;

      renderCanvas();
    };

    const savePreset = () => {
      const name = presetName.value.trim();
      if (!name) return;

      const preset = {
        name,
        width: clampDimension(targetWidth.value),
        height: clampDimension(targetHeight.value),
        format: targetFormat.value,
        backgroundMode: backgroundMode.value,
        backgroundColor: backgroundColor.value,
      };

      const existingIndex = presets.value.findIndex((p) => p.name === name);
      if (existingIndex >= 0) {
        presets.value.splice(existingIndex, 1, preset);
      } else {
        presets.value.push(preset);
      }

      presetName.value = "";
      savePresetsToStorage();
    };

    const applyPreset = (preset) => {
      if (!preset) return;
      targetWidth.value = clampDimension(preset.width);
      targetHeight.value = clampDimension(preset.height);
      targetFormat.value = preset.format || "image/png";
      backgroundMode.value = preset.backgroundMode || "transparent";
      backgroundColor.value = preset.backgroundColor || "#ffffff";
      isPickingColor.value = false;
      renderCanvas();
    };

    const deletePreset = (preset) => {
      presets.value = presets.value.filter((p) => p.name !== preset.name);
      savePresetsToStorage();
    };

    const formatExtension = (format) => {
      switch (format) {
        case "image/png":
          return "png";
        case "image/jpeg":
          return "jpg";
        case "image/webp":
          return "webp";
        default:
          return "img";
      }
    };

    const downloadImage = () => {
      if (!canvas.value || !imageLoaded.value) return;

      renderCanvas({ forExport: true });

      const width = clampDimension(targetWidth.value);
      const height = clampDimension(targetHeight.value);
      const mime = targetFormat.value || "image/png";
      const isJpegLike =
        mime === "image/jpeg" ||
        mime === "image/jpg" ||
        mime === "image/webp";

      const quality = isJpegLike ? 0.92 : undefined;
      const originalName = srcName.value || "image";
      const base = originalName.replace(/\.[^.]+$/, "");
      const filename = `${base || "image"}-${width}x${height}.${formatExtension(
        mime
      )}`;

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = width;
      exportCanvas.height = height;
      const exportCtx = exportCanvas.getContext("2d");
      exportCtx.imageSmoothingEnabled = true;
      exportCtx.imageSmoothingQuality = "high";
      exportCtx.drawImage(
        canvas.value,
        0,
        0,
        canvas.value.width,
        canvas.value.height,
        0,
        0,
        width,
        height
      );

      exportCanvas.toBlob(
        (blob) => {
          renderCanvas();
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        },
        mime,
        quality
      );
    };

    watch(
      [targetWidth, targetHeight, aspectMode, backgroundMode, backgroundColor],
      () => {
        if (imageLoaded.value) {
          renderCanvas();
        }
      }
    );

    watch(
      presets,
      () => {
        savePresetsToStorage();
      },
      { deep: true }
    );

    onMounted(() => {
      loadPresets();
      if (presets.value.length > 0) {
        applyPreset(presets.value[0]);
      } else {
        renderCanvas();
      }
      document.addEventListener("paste", onPaste, true);
    });

    onUnmounted(() => {
      document.removeEventListener("paste", onPaste, true);
    });

    return {
      fileInput,
      canvas,
      isDragOver,
      imageLoaded,
      srcWidth,
      srcHeight,
      targetWidth,
      targetHeight,
      targetFormat,
      canvasAspectStyle,
      aspectMode,
      backgroundMode,
      backgroundColor,
      isPickingColor,
      presetName,
      presets,
      formatLabel,
      onBrowseClick,
      onFileChange,
      onDragOver,
      onDragLeave,
      onDrop,
      startEyedropper,
      onCanvasClick,
      applyPreset,
      deletePreset,
      savePreset,
      downloadImage,
    };
  },
}).mount("#app");

