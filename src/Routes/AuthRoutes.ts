import express, { Router, Request, Response } from "express";
import mongoose, { HydratedDocument } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import UserModel from "../models/UserModel";
import { User, LoginORSignUpResponse, UserDocInterface } from "../types";
import "dotenv/config";
import { OptionalId } from "mongodb";
import authorizedAccess from "../utils/authorizedAccess";

const authRouter = Router();

// Promise<void> , Promise because fn executes async job , void because it returns nothing

// PRODUCTION READY <-- wont be using this in this application
// authRouter.post(
//   "/signup",
//   async (
//     req: Request<{}, {}, LoginSignupRequestBody>,
//     res: Response<LoginSignupResponse>
//   ): Promise<void> => {
//     const { email, password, name } = req.body;
//     try {
//       // fetching User If it exists
//       const user: HydratedDocument<UserInterface> | null =
//         await UserModel.findOne({ email });
//       if (user) {
//         res.status(409).json({ message: `${email} is already registered` });
//         return;
//       }

//       //   hashed password is created
//       const hashedPassword: string = await bcrypt.hash(password, 5);
//       const newUser = new UserModel({ email, password: hashedPassword, name });
//       const savedUser: UserDocInterface = await newUser.save();
//       res.status(201).json({ message: `${email} has been registered` });
//     } catch (err: unknown) {
//       res.status(500).json({
//         message: `${err instanceof Error ? err.message : "unknown Error"}`,
//         apiEndPoint: "/api/v1/auth/signup",
//       });
//     }
//   }
// );

// PRODUCTION READY <-- wont be using this in this application
// authRouter.post(
//   "/login",
//   async (
//     req: Request<{}, {}, LoginSignupRequestBody>,
//     res: Response<LoginSignupResponse>
//   ): Promise<void> => {
//     const { email, password } = req.body;
//     try {
//       // finding user based on email
//       const user: UserInterface | null = await UserModel.findOne({ email });
//       if (!user) {
//         res.status(404).json({ message: "Email Id is not registered" });
//         return;
//       } else if (user.oauth) {
//         const googleOAuthURL = `https://accounts.google.com/o/oauth2/v2/auth?
//         client_id=${process.env.GOOGLE_CLIENT_ID}&
//         redirect_uri=${process.env.GOOGLE_BACKEND_REDIRECT_URI}&
//         response_type=code&
//         scope=profile email`;
//         res.redirect(googleOAuthURL);
//         return;
//       }

//       const correctPWD: boolean = await bcrypt.compare(
//         password,
//         user.password ?? ""
//       );
//       if (!correctPWD) {
//         res.status(401).json({ message: "Incorrect Password" });
//         return;
//       }

//       const secretKey: string | void = process.env.SECRET_KEY;
//       if (!secretKey) {
//         throw new Error("Secret Key to generate JWT token is not provided");
//       }
//       const token: string = jwt.sign(
//         {
//           email: user.email,
//           name: user.name,
//           userId: user._id,
//         },
//         secretKey,
//         { expiresIn: "10h" }
//       );

//       res.status(200).json({ message: "Successfull Login", token });
//     } catch (error: unknown) {
//       res.status(500).json({
//         message: `${
//           error instanceof Error ? error.message : "Unknown message"
//         }`,
//         apiEndPoint: "/api/v1/auth/login",
//       });
//     }
//   }
// );

// PRODUCTION READY <-- google/ouath/redirection
authRouter.get("/google/oauth", (req: Request, res: Response): void => {
  const googleOAuthURL: string = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_BACKEND_REDIRECT_URI}&response_type=code&scope=profile email`;
  res.redirect(googleOAuthURL);
});

// PRODUCTION READY <-- google/callback/redirection
authRouter.get(
  "/google/oauth/callback",
  async (
    req: Request<{}, {}, {}, { code: string }>,
    res: Response<LoginORSignUpResponse>
  ): Promise<void> => {
    const { code } = req.query;
    try {
      const params: {
        code: string;
        client_id: string;
        client_secret: string;
        redirect_uri: string;
        grant_type: string;
      } = {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: process.env.GOOGLE_BACKEND_REDIRECT_URI ?? "",
        grant_type: "authorization_code",
      };
      const fetchedData = await fetch(`https://oauth2.googleapis.com/token`, {
        method: "POST",
        body: new URLSearchParams(params).toString(),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
      });
      const { access_token }: { access_token: string } =
        await fetchedData.json();

      // id & email
      const fetchRes2 = await fetch(
        "https://www.googleapis.com/oauth2/v1/userinfo",
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${access_token}`,
          },
        }
      );
      const data2 = await fetchRes2.json();
      const { email, id }: { email: string; id: string } = data2;

      // Fetching User Email Id
      const user: UserDocInterface | null = await UserModel.findOne({ email });

      if (!user) {
        // WHEN USER DOESNOT EXIST
        // CREATE NEW USER
        // SEND JWT
        const newUser: UserDocInterface = new UserModel({ email, userId: id });
        const newUserSaved: UserDocInterface = await newUser.save();
        const token: string = jwt.sign(
          {
            email: newUserSaved.email,
            userId: newUserSaved._id,
          },
          process.env.SECRET_KEY ?? "",
          { expiresIn: "10h" }
        );
        res.redirect(
          `${process.env.frontendURL}/user/auth/photos?token=${token}`
        );
        return;
      }
      // USER EXISTS
      const token: string = jwt.sign(
        {
          email: user.email,
          userId: user._id,
        },
        process.env.SECRET_KEY ?? "",
        { expiresIn: "10h" }
      );
      res.redirect(
        `${process.env.frontendURL}/user/auth/photos?token=${token}`
      );
      return;
    } catch (err: unknown) {
      res.redirect(
        `${process.env.frontendURL}/user/login?issue=${
          err instanceof Error && err.message
        }`
      );
    }
  }
);

authRouter.get(
  "/fetch/users",
  authorizedAccess,
  async (
    req,
    res: Response<{ message: string; userList?: UserDocInterface[] }>
  ) => {
    const { email } = req.user;
    try {
      const userList: UserDocInterface[] = await UserModel.find({
        email: { $nin: [email] },
      });
      res.status(200).json({ message: "Users Fetched", userList });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch students" });
    }
  }
);

export default authRouter;
