const { createApp, ref, reactive, computed, watch, onMounted } = Vue;

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

    const renderCanvas = () => {
      if (!canvas.value) return;

      const ctx = canvas.value.getContext("2d");
      const width = clampDimension(targetWidth.value || srcWidth.value || 1);
      const height = clampDimension(targetHeight.value || srcHeight.value || 1);

      targetWidth.value = width;
      targetHeight.value = height;

      canvas.value.width = width * dpr;
      canvas.value.height = height * dpr;

      canvas.value.style.width = `${width}px`;
      canvas.value.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

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
        aspectMode: aspectMode.value,
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
      aspectMode.value = preset.aspectMode || "fit";
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

      const mime = targetFormat.value || "image/png";
      const isJpegLike =
        mime === "image/jpeg" ||
        mime === "image/jpg" ||
        mime === "image/webp";

      const quality = isJpegLike ? 0.92 : undefined;
      const originalName = srcName.value || "image";
      const base = originalName.replace(/\.[^.]+$/, "");
      const filename = `${base || "image"}-${targetWidth.value}x${targetHeight.value}.${formatExtension(
        mime
      )}`;

      canvas.value.toBlob(
        (blob) => {
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
      renderCanvas();
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

