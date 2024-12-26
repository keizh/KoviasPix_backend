import { Router, Request, Response } from "express";
import multer from "multer";
import ImageModel from "../models/ImageModel";
import { commentOBJ, ImageDocInterface } from "../types";
import { v2 as cloudinary } from "cloudinary";
import authorizedAccess from "../utils/authorizedAccess";
const uploads = multer({
  storage: multer.diskStorage({}),
  limits: {
    fileSize: 11 * 1024 * 1024,
  },
});
import { ImageInterface } from "../types";

export const imageRouter = Router();
// RESPONSIBLE FOR UPLOADING IMAGE
imageRouter.post(
  "/imgs",
  authorizedAccess,
  uploads.array("images", 10),
  async (
    req,
    res: Response<{
      message: string;
      savedImages?: ImageInterface[];
      tags?: string[];
    }>
  ) => {
    // @ts-ignore
    const files = req.files;
    const { userId } = req.user;
    const { albumId, name, tags } = req.body;
    try {
      console.log(`-->`, albumId, name, tags);
      const savedImages: ImageDocInterface[] = [];
      for (const file of files) {
        const uploaded = await cloudinary.uploader.upload(file.path);
        const newImage = new ImageModel({
          imgURL: uploaded.secure_url,
          public_id: uploaded.public_id,
          imgOwnerId: userId,
          albumId: albumId,
          name,
          tags,
          size: file.size,
          person: "",
          comments: [],
          isFavorite: false,
        });

        const newImageSaved: ImageDocInterface = await newImage.save();
        savedImages.push(newImageSaved);
      }
      console.log(savedImages);
      res
        .status(200)
        .json({ message: "Image has been uploaded", savedImages, tags });
    } catch (err) {
      const mssg =
        err instanceof Error ? err.message : "Failed to upload image";
      res.status(500).json({ message: mssg });
    }
  }
);

// imageId: string;
// imgURL: string;
// imgOwnerId: string;
// albumId: string;
// name?: string;
// tags?: string[];
// person?: string;
// isFavorite?: boolean;
// comments?: commentOBJ[];
// size: string;

// RESPONSIBLE FOR MARKING THE STAR FAVORITE
imageRouter.post(
  "/isFavoriteIMG",
  authorizedAccess,
  async (
    req: Request<{}, {}, { isFavorite: boolean }, { imageId: string }>,
    res: Response<{ message: string }>
  ): Promise<void> => {
    const { imageId } = req.query;
    const { isFavorite } = req.body;
    try {
      const updateImage = await ImageModel.findOneAndUpdate(
        { imageId },
        { $set: { isFavorite } },
        { new: true }
      );
    } catch (err: unknown) {
      const mssg = err instanceof Error ? err.message : "";
      res.status(500).json({ message: mssg });
    }
  }
);

// RESPONSIBLE FOR ADDING COMMENT
imageRouter.post(
  "/comment/add",
  authorizedAccess,
  async (
    req: Request<{}, {}, { imageId: string; comment: string }, {}>,
    res: Response
  ): Promise<void> => {
    const { comment, imageId } = req.body;
    const { userId } = req.user;
    try {
      const comment_OBJ: commentOBJ = { comment, commentOwnerId: userId };
      const imageWithCommentAdded: ImageDocInterface | null =
        await ImageModel.findOneAndUpdate(
          {
            imageId,
          },
          {
            $addToSet: { comments: comment_OBJ },
          }
        );
      if (imageWithCommentAdded) {
        res.status(200).json({ message: `Comment added` });
      } else {
        res.status(404).json({ message: `No such Image Exists` });
      }
    } catch (err: unknown) {
      const mssg = err instanceof Error ? err.message : "Failed to add Comment";
      res.status(500).json({ message: mssg });
    }
  }
);

// RESPONSIBLE FOR REMOVING COMMENT
imageRouter.post(
  "/comment/remove",
  authorizedAccess,
  async (
    req: Request<
      {},
      {},
      { imageId: string; commentId: string; imgOwnerId: string },
      {}
    >,
    res: Response<{ message: string }>
  ): Promise<void> => {
    const { commentId, imageId, imgOwnerId } = req.body;
    const { userId } = req.user;
    try {
      const imageWithCommentRemoved = await ImageModel.findOneAndUpdate(
        {
          imageId,
        },
        {
          $pull: { comments: { commentId, commentOwnerId: userId } },
        }
      );
      if (imageWithCommentRemoved) {
        res.status(200).json({ message: `Comment removed` });
      } else {
        res.status(404).json({ message: `No such Image Exists` });
      }
    } catch (err: unknown) {
      const mssg =
        err instanceof Error ? err.message : "Failed to remove Comment";
      res.status(500).json({ message: mssg });
    }
  }
);

imageRouter.delete(
  `/delete/:imageId`,
  authorizedAccess,
  async (
    req: Request<{ imageId: string }, {}, {}, {}>,
    res: Response<{ message: string }>
  ) => {
    try {
      const { userId } = req.user;
      const { imageId } = req.params;
      const Img: ImageDocInterface | null = await ImageModel.findOne({
        imageId,
        imgOwnerId: userId,
      });
      const deletedImg: ImageDocInterface | null =
        await ImageModel.findOneAndDelete({
          imageId,
          imgOwnerId: userId,
        });
      if (deletedImg && Img) {
        await cloudinary.uploader.destroy(Img.public_id);
        res.status(200).json({ message: `Image Successfully deleted` });
      } else {
        throw new Error(`Failed to Delete Image`);
      }
    } catch (err: unknown) {
      const mssg =
        err instanceof Error ? err.message : "Failed to delete Image";
      res.status(500).json({ message: mssg });
    }
  }
);

imageRouter.get(
  "/:albumId",
  authorizedAccess,
  async (
    req: Request<{ albumId: string }, {}, {}, {}>,
    res: Response<{
      images?: ImageDocInterface[] | null;
      message: string;
      tags?: string[];
    }>
  ): Promise<void> => {
    console.log(`line 202`);
    const { albumId } = req.params;
    console.log(albumId);
    try {
      const images: ImageDocInterface[] | [] = await ImageModel.find({
        albumId,
      });
      console.log(images);
      const tags = Array.isArray(images)
        ? Array.from(
            new Set(
              images.reduce((acc: string[], img: ImageDocInterface) => {
                const tagList: string[] = Array.isArray(img.tags)
                  ? img.tags
                  : [];
                return [...acc, ...tagList];
              }, [] as string[])
            )
          )
        : [];
      console.log(tags);
      console.log(`line 221`);
      res
        .status(200)
        .json({ message: "Images have been fetched", images, tags });
      console.log(`line 225`);
    } catch (err: unknown) {
      const mssg =
        err instanceof Error ? err.message : "Failed to delete Image";
      res.status(500).json({ message: mssg });
      console.log(`line 230`);
    }
  }
);

imageRouter.get(
  "/:albumId/favorite",
  authorizedAccess,
  async (
    req: Request<{ albumId: string }, {}, {}, {}>,
    res: Response<{ images?: ImageDocInterface[] | null; message: string }>
  ): Promise<void> => {
    const { albumId } = req.params;
    try {
      const images: ImageDocInterface[] | [] = await ImageModel.find({
        albumId,
        isFavorite: true,
      });
      res.status(200).json({ message: "Images have been fetched", images });
    } catch (err: unknown) {
      const mssg =
        err instanceof Error ? err.message : "Failed to delete Image";
      res.status(500).json({ message: mssg });
    }
  }
);

imageRouter.get(
  "/:albumId/tags",
  authorizedAccess,
  async (
    req: Request<{ albumId: string }, {}, {}, { tagName: string }>,
    res: Response<{ images?: ImageDocInterface[] | null; message: string }>
  ): Promise<void> => {
    const { albumId } = req.params;
    const { tagName } = req.query;
    try {
      const images: ImageDocInterface[] | [] = await ImageModel.find({
        albumId,
        tags: { $in: [tagName] },
      });
      res.status(200).json({ message: "Images have been fetched", images });
    } catch (err: unknown) {
      const mssg =
        err instanceof Error ? err.message : "Failed to delete Image";
      res.status(500).json({ message: mssg });
    }
  }
);
