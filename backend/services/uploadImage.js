import cloudinary from "../config/cloudinary.js"

export const DISH_IMAGES_FOLDER = "comanda/dishes" // admin uploads get a random id inside it, the seed uses the dish code

// upload_stream works with a callback: wrapped in a Promise so controllers can await it.
// options: extra Cloudinary settings, e.g. the seed's fixed { public_id, overwrite }
export const uploadImage = (buffer, folder, options = {}) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, ...options }, (cloudErr, result) => {
      if (cloudErr) {
        console.error("Cloudinary upload failed:", cloudErr)
        const err = new Error("Image upload failed")
        err.status = 502 // our request was fine, the image service failed
        err.code = "IMAGE_UPLOAD_FAILED"
        return reject(err)
      }
      resolve({ url: result.secure_url, publicId: result.public_id })
    })
    stream.end(buffer) // memoryStorage gives a Buffer: write it all and close the stream
  })

export const deleteImage = (publicId) => cloudinary.uploader.destroy(publicId, { invalidate: true }) // invalidate: also clears the CDN cache, so the old url stops serving the photo
