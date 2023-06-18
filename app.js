var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

const AWS = require('aws-sdk')
const multer = require('multer')

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

require('dotenv').config()

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


const aswConfig = {
  accessKeyId: process.env.ACCESSKEY,
  secretAccessKey: process.env.SECRETACCESSKEY,
  region: process.env.AWSREGION
}

const S3 = new AWS.S3(aswConfig)

app.use('/', indexRouter);
app.use('/users', usersRouter);

//multer config
//multer middleware
let upload = multer({
  limits: 1024 * 1024 * 5, //how much mb limits
  fileFilter: (req, file, done) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg' || file.mimetype === 'image/png') {
      done(null, true)
    } else {
      done("Multer error - File type is not supported", false)
    }
  }
})

// Upload to s3 bucket

const uploadToS3 = (fileData) => {
  return new Promise((resolve, reject) => {
    let params = {
      Bucket: process.env.BUCKETNAME, //buckeName
      Key: `image${Date.now().toString()}.jpg`, //Unic File name saving purpose
      Body: fileData,
    }

    S3.upload(params, (err, data) => {
      if (err) {
        console.log("error", err)
        reject(err)
      }
      console.log("Data", data)
      return resolve(data)
    })

  })
}


//signle image uploading
app.post('/upload', upload.single("image"), (req, res) => {//multer middleware // upload.single("image") <==in bracket i written image name for get the image from tjis name only 
  console.log(req.file)
  if (req.file) {
    uploadToS3(req.file.buffer).then((result) => {
      console.log("result", result)
      return res.json({
        message: "Upload SuccessFully",
        imgUrl: result.Location,
        Key: result.Key
      })
    }).catch((err) => {
      console.log("err", err)
    })
  }
})

// Retrieve a specific image URL from S3 bucket
const getSpecificImage = (imageKey) => {
  console.log("getSpecificImage", imageKey)
  return new Promise((resolve, reject) => {
    let params = {
      Bucket: process.env.BUCKETNAME, // Bucket name
      Key: imageKey, // Key of the specific image
      Expires: 300 // Expiration time in seconds (e.g., 180 seconds = 3 minutes)
    }

    S3.getSignedUrl('getObject', params, (err, url) => {
      if (err) {
        console.log("Error retrieving image", err);
        reject(err);
      }
      // setTimeout(() => {
      //   // Delete the image from S3 bucket after 3 seconds
      //   S3.deleteObject(params, (deleteErr) => {
      //     if (deleteErr) {
      //       console.log("Error deleting image", deleteErr);
      //     } else {
      //       console.log("Image deleted successfully");
      //     }
      //   });
      // }, 3000); // 3 seconds delay for deletion
      console.log("Image URL", url);
      return resolve(url);
    });
  });
};

// API endpoint to get a specific image URL
app.get('/images/:imageKey', (req, res) => {
  const imageKey = req.params.imageKey;
  // const imageKey = req.body.imageKey;
  getSpecificImage(imageKey)
    .then((imageUrl) => {
      console.log("imageUrl", imageUrl)
      if (imageUrl) {
        res.json({
          messgae: "Geting Image URL Successfully",
          imageUrl: imageUrl
        });
      } else {
        res.status(404).json({ error: "Image not found" });
      }
    })
    .catch((err) => {
      console.log("Error retrieving image", err);
      res.status(500).json({ error: "Internal Server Error" });
    });
});




// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
