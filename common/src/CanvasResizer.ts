export default class CanvasResizer {
    resize(
        canvas: HTMLCanvasElement,
        ctx: CanvasRenderingContext2D,
        maxWidth: number,
        maxHeight: number
    ): Promise<HTMLCanvasElement> {
        return new Promise((resolve, reject) => {
            const widthRatio = maxWidth <= 0 ? 1 : maxWidth / canvas.width;
            const heightRatio = maxHeight <= 0 ? 1 : maxHeight / canvas.height;
            const ratio = Math.min(1, Math.min(widthRatio, heightRatio));

            if (ratio < 1) {
                const newWidth = canvas.width * ratio;
                const newHeight = canvas.height * ratio;
                createImageBitmap(canvas, { resizeWidth: newWidth, resizeHeight: newHeight })
                    .then((sprite) => {
                        canvas.width = newWidth;
                        canvas.height = newHeight;
                        ctx.drawImage(sprite, 0, 0);
                        resolve(canvas);
                    })
                    .catch((e) => reject(e));
            } else {
                resolve(canvas);
            }
        });
    }
}
