const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
require("dotenv").config();

// Port Setup
const app = express();
const PORT = process.env.PORT || 5000;

// MongoDB URL
const url = process.env.MONGO_URL;

// MongoDB Connection
mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
const con = mongoose.connection;
con.on("open", () => console.log("MongoDB is connected"));

// MiddleWare

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

app.use("/", require("./Routes/users.js"));

app.get("/", (request, response) => {
  response.send("Password Reset APP ");
});

app.listen(PORT, () => console.log("Server STarted !!!"));
