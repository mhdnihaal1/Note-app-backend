require("dotenv").config();

const config = require("./config.json");
const mongoose = require("mongoose");

mongoose.connect(config.connectionString);

const User = require("./model/user_model");
const Note = require("./model/note_model");

const express = require("express");
const cors = require("cors");
const app = express();

const jwt = require("jsonwebtoken");
const { authenticateToken } = require("./utilities");

app.use(express.json());

app.use(
  cors({
    origin: "*",
  })
);

app.get("/", (req, res) => {
  res.send("Server is running on local host 8000");
});

app.post("/create-account", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName) {
      return res.status(400).json({
        error: true,
        message: "Full Name is required",
      });
    }

    if (!email) {
      return res.status(400).json({
        error: true,
        message: "Email is required",
      });
    }

    if (!password) {
      return res.status(400).json({
        error: true,
        message: "Password is required",
      });
    }

    const isUser = await User.findOne({ email });
    if (isUser) {
      return res.status(409).json({
        error: true,
        message: "User already exists",
      });
    }

    const user = new User({
      fullName,
      email,
      password,
    });
    const saved = await user.save();

    const accessToken = jwt.sign(
      { id: user._id, email: user.email },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "30m" }
    );

    return res.status(201).json({
      error: false,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
      accessToken,
      message: "Register successful",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
    });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email) {
    return res.status(400).json({
      error: true,
      message: "Email is required",
    });
  }

  if (!password) {
    return res.status(400).json({
      error: true,
      message: "Password is required",
    });
  }

  const userInfo = await User.findOne({ email: email });

  if (!userInfo) {
    return res.status(400).json({ message: "User not found" });
  }

  if (userInfo.email == email && userInfo.password == password) {
    const user = { user: userInfo };
    const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "36000m",
    });

    return res.json({
      error: false,
      message: "Login successfull",
      email,
      accessToken,
    });
  } else {
    return res.status(400).json({
      error: false,
      message: "Invalid Credentials",
    });
  }
});

app.get("/get-user", authenticateToken, async (req, res) => {
  let id;
  if (req.user?.user?._id) {
    id = req.user.user._id;
  } else {
    id = req.user.id;
  }
  const isUser = await User.findOne({ _id: id });

  if (!isUser) {
    return res.sendStatus(401);
  }

  return res.json({
    user: {
      fullName: isUser.fullName,
      email: isUser.email,
      _id: isUser._id,
      createdOn: isUser.createdOn,
    },
    message: "",
  });
});

app.post("/add-note", authenticateToken, async (req, res) => {
  const { title, content, tags } = req.body;
  console.log(12, req.user);

  let id;
  if (req.user?.user?._id) {
    id = req.user.user._id;
  } else {
    id = req.user.id;
  }

  if (!title) {
    return res.status(400).json({
      error: true,
      message: "Title is required",
    });
  }
  if (!content) {
    return res.status(400).json({
      error: true,
      message: "Content is required",
    });
  }

  try {
    const note = new Note({
      title,
      content,
      tags: tags || [],
      userId: id,
    });

    const saved = await note.save();

    return res.json({
      error: false,
      note,
      message: "Note added successfully",
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
    });
  }
});

app.put("/edit-note/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { title, content, tags, isPinned } = req.body;
  let id;
  if (req.user?.user?._id) {
    id = req.user.user._id;
  } else {
    id = req.user.id;
  }
  if (!title && !content && !tags) {
    return res
      .status(400)
      .json({ error: true, messaage: "No changes provided " });
  }

  try {
    const note = await Note.findOne({ _id: noteId, userId: id }).populate(
      "userId"
    );

    if (!note) {
      return res.status(404).json({ error: true, message: "Note not found" });
    }

    if (title) note.title = title;
    if (content) note.content = content;
    if (tags) note.tags = tags;
    if (isPinned) note.isPinned = isPinned;

    await note.save();

    return res.json({
      error: false,
      note,
      message: "Note updated successfully",
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
    });
  }
});

app.get("/get-all-notes", authenticateToken, async (req, res) => {
  try {
    let id;
    if (req.user?.user?._id) {
      id = req.user.user._id;
    } else {
      id = req.user.id;
    }
    const notes = await Note.find({ userId: id })
      .sort({ isPinned: -1 })
      .populate("userId");

    return res.json({
      error: false,
      notes,
      message: "All notes retrieved successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: true,
      message: "Internal server error ",
    });
  }
});

app.delete("/delete-note/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  let id;
  if (req.user?.user?._id) {
    id = req.user.user._id;
  } else {
    id = req.user.id;
  }
  try {
    const note = await Note.findOne({ _id: noteId, userId: id }).populate(
      "userId"
    );

    if (!note) {
      return res.status(404).json({ error: true, message: "Note not found" });
    }

    await Note.deleteOne({ _id: noteId, userId: id }).populate("userId");

    return res.json({
      error: false,
      message: "Note deleted successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
    });
  }
});

app.put("/update-note-pinned/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { isPinned } = req.body;
  let id;
  if (req.user?.user?._id) {
    id = req.user.user._id;
  } else {
    id = req.user.id;
  }
  if (!isPinned) {
    return res
      .status(400)
      .json({ error: true, messaage: "No changes provided " });
  }

  try {
    const note = await Note.findOne({ _id: noteId, userId: id }).populate(
      "userId"
    );

    if (!note) {
      return res.status(404).json({ error: true, message: "Note not found" });
    }

    if (note.isPinned == true) {
      note.isPinned = false;
    } else {
      note.isPinned = true;
    }

    await note.save();

    return res.json({
      error: false,
      note,
      message: "Note updated successfully",
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
    });
  }
});

app.get("/search-notes", authenticateToken, async (req, res) => {
  // console.log(123)
  let id;
  if (req.user?.user?._id) {
    id = req.user.user._id;
  } else {
    id = req.user.id;
  }
  const { query } = req.query;
  //    console.log(query)

  if (!query) {
    return res
      .status(400)
      .json({ error: truen, message: "Search query is required " });
  }

  try {
    const matchingNotes = await Note.find({
      userId: id,
      $or: [
        { title: { $regex: new RegExp(query, "i") } }, // Correct usage of RegExp
        { content: { $regex: new RegExp(query, "i") } }, // Correct usage of RegExp
      ],
    }).populate("userId");

    return res.json({
      error: false,
      notes: matchingNotes,
      message: "Notes matching the search query retrieved successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

app.listen(8000, () => {
  console.log("Running on port 8000");
});

module.exports = app;
