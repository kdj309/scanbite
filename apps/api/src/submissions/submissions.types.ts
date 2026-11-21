/** The parts of an uploaded label photo the service reads. */
export type UploadedPhoto = Pick<
  Express.Multer.File,
  "buffer" | "mimetype" | "originalname"
>;
