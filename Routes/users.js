const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const User = require("../Models/user.js");

const router = express.Router();

const transport = nodemailer.createTransport({
  // host: "smtp.mailtrap.io",
  // port: 2525,
  // auth: {
  //   user: "0728a23fb4ef4a",
  //   pass: "f57b5923d014d7",
  // },

  // host: "smtp.mailgun.org",
  // port: 587,
  // auth: {
  //   user: "postmaster@sandboxc01c66e8b2974ae3abeee66be9237555.mailgun.org",
  //   pass: "d6dd156b5921fe892dab637e1704de78-c485922e-12fe8d47",
  // },

//   service: "gmail",
//   auth: {
//     user: process.env.EMAIL,
//     pass: process.env.PASSWORD,
//   },
  
   host: "in-v3.mailjet.com",
  port: 587,
  auth: {
    user: "36b10ee7a46a5c186d77bfe82bd5102b",
    pass: "d4f2fe4931cc318e219e68cd3edc31ae",
  },
});

router
  .route("/users")
  //Get User Details
  .get(async (request, response) => {
    const users = await User.find();
    response.send(users);
  })
  //Add User
  .post(async (request, response) => {
    const addUser = request.body;
    const user = new User(addUser);

    try {
      const newUser = await user.save();
      response.send(newUser);
    } catch (err) {
      response.status(500);
      response.send(err);
    }
  });

router
  .route("/users/:id")
  // Get User By ID
  .get(async (request, response) => {
    const { id } = request.params;
    const users = await User.findById(id);
    response.send(users);
  })
  // Delete Users
  .delete(async (request, response) => {
    const { id } = request.params;
    try {
      const user = await User.findById(id);
      await user.remove();
      response.send({ ...user, message: "Deleted successfully" });
    } catch (err) {
      response.status(500);
      response.send("User is missing");
    }
  })
  .patch(async (request, response) => {
    const { id } = request.params;
    const { name, avatar } = request.body;

    try {
      const user = await User.findById(id);
      if (name) {
        user.name = name;
      }
      if (avatar) {
        user.avatar = avatar;
      }
      await user.save();
      response.send(user);
    } catch (err) {
      response.status(500);
      response.send(err);
    }
  });

//Signin
router.route("/signin").post(async (request, response) => {
  try {
    const { email, password } = request.body;
    const findUser = await User.findOne({ email: email });
    if (!findUser) {
      return response.status(401).send({ message: "Invalid credentials" });
    } else if (!findUser.confirm) {
      return response.status(403).json({ message: "Verify Email" });
    } else if (
      findUser &&
      (await bcrypt.compare(password, findUser.password))
    ) {
      const genToken = jwt.sign({ id: findUser._id }, "mysecretkey");
      response.cookie("jwtToken", genToken, {
        sameSite: "strict",
        expires: new Date(new Date().getTime() + 3600 * 1000),
        httpOnly: true,
      });
      return response.status(200).json({ message: "Signin Success !" });
    } else {
      return response.status(401).send({ message: "Invalid credentials" });
    }
  } catch (err) {
    response.status(500);
    response.send(err);
  }
});

// SignUp
router.route("/signup").post(async (request, response) => {
  const { name, surname, email, password } = request.body;
  try {
    const userExist = await User.findOne({ email: email });
    if (userExist) {
      return response.status(409).json({ error: "Email All Ready Exist" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      surname,
      email,
      password: passwordHash,
    });
    await user.save();
    console.log(user._id);

    const token = jwt.sign({ id: user._id }, "secretKey", {
      expiresIn: "1d",
    });
    console.log(token);
    transport.sendMail({
      to: user.email,
     from: "prathameshsarode80@gmail.com",
      subject: `Signup Successful`,
      html: `
      <h1>Welcome, ${user.name} ${user.surname} To Dark Services</h1>
      <h5>Click on <a href="https://password-reset-mail.herokuapp.com/verify?token=${token}">Link</a> , To Activate Account.</h5>
      <p>Doing The Above Step Help US :)</p>
      `,
    });
    response.status(200).json({ message: "User Registered" });
  } catch (err) {
    response.status(500);
    response.send(err);
  }
});

// Verify Email After Signup
router.route("/verify").get(async (request, response) => {
  try {
    const token = request.query.token;
    if (token) {
      const { id } = jwt.verify(token, "secretKey");
      await User.updateOne({ _id: id }, { confirm: true });
      response.redirect("https://password-reset-mail.herokuapp.com/signin");
    } else {
      response.status(401).json({ message: "Invalid Token" });
    }
  } catch (err) {
    response.status(500).send({ message: "Server Error" });
  }
});

//Forgot Password Link Creation
router.route("/reset").post(async (request, response) => {
  const { email } = request.body;
  crypto.randomBytes(32, async (err, buffer) => {
    if (err) {
      console.log(err);
      return response.status(500).json({ message: "Crypto Gen failed" });
    }
    const token = buffer.toString("hex");
    try {
      const findUser = await User.findOne({ email: email });
      if (!findUser) {
        return response.status(401).json({ message: "Register First" });
      }
      findUser.resetToken = token;
      findUser.expireTime = Date.now() + 3600000;

      await findUser.save();

      transport.sendMail({
        to: findUser.email,
        from: "prathameshsarode80@gmail.com",
        subject: `To Reset Password`,
        html: `
                <p>You Requested For Password Reset</p>
                <h5>Click on <a href="https://password-reset-mail.netlify.app/reset/${token}">Link</a> , to RESET Password.</h5>
              `,
      });
      response.status(200).json({ message: "Email Send." });
    } catch (error) {
      response.status(500);
      response.send(error);
    }
  });
});

//Password Reset
router.route("/password-reset").post(async (request, response) => {
  const { newPassword, sentToken } = request.body;
  try {
    const findUser = await User.findOne({
      resetToken: sentToken,
      expireTime: { $gt: Date.now() },
    });
    if (!findUser)
      return response.status(403).json({ message: "Session Expired" });

    const passwordHash = await bcrypt.hash(newPassword, 10);

    findUser.password = passwordHash;
    findUser.resetToken = undefined;
    findUser.expireTime = undefined;

    await findUser.save();

    response.status(200).json({ message: "Password Updated" });
  } catch (error) {
    response.status(500);
    response.send(error);
  }
});

module.exports = router;
