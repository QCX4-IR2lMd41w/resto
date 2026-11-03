const MAX_SIDE = 1600;

/**
 * Shrinks a photo in the browser before upload (Workers can't process images).
 * Re-encoding to JPEG also strips EXIF metadata. Falls back to the original file if the
 * browser can't decode it – the server validates the upload either way.
 */
export async function resizeImage(file: File): Promise<File> {
    try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        return blob ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file;
    } catch {
        return file;
    }
}
