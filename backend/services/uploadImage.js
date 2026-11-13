import cloudinary from "../config/cloudinary.js"
import httpError from "../utils/httpError.js"

export const DISH_IMAGES_FOLDER = "comanda/dishes" // admin uploads get a random id inside it, the seed uses the dish code

// upload_stream works with a callback: wrapped in a Promise so controllers can await it.
// options: extra Cloudinary settings, e.g. the seed's fixed { public_id, overwrite }
export const uploadImage = (buffer, options = {}) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: DISH_IMAGES_FOLDER, ...options }, (cloudErr, result) => {
      if (cloudErr) {
        console.error("Cloudinary upload failed:", cloudErr)
        return reject(httpError(502, "IMAGE_UPLOAD_FAILED", "Image upload failed")) // our request was fine, the image service failed
      }
      resolve({ url: result.secure_url, publicId: result.public_id })
    })
    stream.end(buffer) // memoryStorage gives a Buffer: write it all and close the stream
  })

export const deleteImage = (publicId) => cloudinary.uploader.destroy(publicId, { invalidate: true }) // invalidate: also clears the CDN cache, so the old url stops serving the photo
