const THUMBNAIL = 'c_fill,ar_4:3,f_auto,q_auto,w_400' // same 4:3 crop everywhere, so all cards line up

const thumbnailUrl = (url, transformation = THUMBNAIL) => // Cloudinary resizes on the fly when the transformation sits right after "/image/upload/"
  url.includes('/image/upload/') ? url.replace('/image/upload/', `/image/upload/${transformation}/`) : url

export default thumbnailUrl
