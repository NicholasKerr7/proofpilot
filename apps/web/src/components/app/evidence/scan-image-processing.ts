export type ScanRotation = 0 | 90 | 180 | 270;
export type ScanCropInset = 0 | 5 | 10 | 15;

export async function prepareScanImage(
  file: File,
  rotation: ScanRotation,
  cropInset: ScanCropInset
) {
  if (rotation === 0 && cropInset === 0) {
    return file;
  }

  const source = await loadImage(file);

  try {
    const insetRatio = cropInset / 100;
    const sourceX = Math.round(source.image.naturalWidth * insetRatio);
    const sourceY = Math.round(source.image.naturalHeight * insetRatio);
    const sourceWidth = source.image.naturalWidth - sourceX * 2;
    const sourceHeight = source.image.naturalHeight - sourceY * 2;

    if (sourceWidth < 1 || sourceHeight < 1) {
      throw new Error("The selected crop is too small.");
    }

    const swapsDimensions = rotation === 90 || rotation === 270;
    const canvas = document.createElement("canvas");
    canvas.width = swapsDimensions ? sourceHeight : sourceWidth;
    canvas.height = swapsDimensions ? sourceWidth : sourceHeight;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("This browser could not prepare the scanned image.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((rotation * Math.PI) / 180);
    context.drawImage(
      source.image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      -sourceWidth / 2,
      -sourceHeight / 2,
      sourceWidth,
      sourceHeight
    );

    const blob = await getCanvasBlob(canvas);
    return new File([blob], createEditedFileName(file.name), {
      lastModified: Date.now(),
      type: "image/jpeg"
    });
  } finally {
    source.release();
  }
}

function loadImage(file: File) {
  return new Promise<{ image: HTMLImageElement; release: () => void }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.addEventListener("load", () => {
      resolve({
        image,
        release: () => URL.revokeObjectURL(objectUrl)
      });
    });
    image.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The scanned image could not be opened."));
    });
    image.src = objectUrl;
  });
}

function getCanvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("The scanned image could not be prepared."));
      },
      "image/jpeg",
      0.92
    );
  });
}

function createEditedFileName(originalName: string) {
  const baseName = originalName.replace(/\.[^.]+$/, "").slice(0, 120) || "proofpilot-scan";
  return `${baseName}-edited.jpg`;
}
