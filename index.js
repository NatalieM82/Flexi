//index.js/
var express = require('express'),
    exphbs = require('express3-handlebars'),
    logger = require('morgan'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    methodOverride = require('method-override'),
    session = require('express-session'),
    passport = require('passport'),
    LocalStrategy = require('passport-local'),
    aws = require('aws-sdk');

var flash = require('express-flash');
var path = require('path');
var fs = require('fs');
var async = require('async');
var crypto = require('crypto');
var nodemailer = require('nodemailer');
var url = require('url');

var nodeExcel = require('excel-export');
var dateFormat = require('dateformat');



var AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
var AWS_SECRET_KEY = process.env.AWS_SECRET_KEY;
var S3_BUCKET = process.env.S3_BUCKET;

//We will be creating these two files shortly
 var funct = require('./functions.js'); //funct file contains our helper functions for our Passport and database work

var app = express();
app.use('/includes',express.static(path.join(__dirname, 'includes')));
app.use('/images',express.static(path.join(__dirname, 'images')));
app.use(express.static(__dirname + 'views/public'));


//===============PASSPORT===============

// Passport session setup.
passport.serializeUser(function(user, done) {
  console.log("serializing " + user.email);
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  console.log("deserializing " + obj);
  done(null, obj);
});

// Use the LocalStrategy within Passport to login/”signin” users.
passport.use('local-signin', new LocalStrategy({     
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : true}, //allows us to pass back the request to the callback
  function(req, email, password, done) {
    funct.localAuth(email, password)
    .then(function (user) {
      if (user) {
        console.log("LOGGED IN AS: " + user.email);
        req.session.success = 'You are successfully logged in ' + user.email + '!';
        done(null, user);
      }
      if (!user) {
        console.log("COULD NOT LOG IN");
        req.session.error = 'Could not log user in. Please try again.'; //inform user could not log them in
        done(null, user);
      }
    })
    .fail(function (err){
      console.log(err.body);
    });
  }
));
// Use the LocalStrategy within Passport to register/"signup" users.
passport.use('local-signup', new LocalStrategy({
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : true}, //allows us to pass back the request to the callback
  function(req, email, password, done) {
    funct.localReg(email, password)
    .then(function (user) {
      if (user) {
        console.log("REGISTERED: " + user.email);
        req.session.success = 'You are successfully registered and logged in ' + user.email + '!';
        done(null, user);
      }
      if (!user) {
        console.log("COULD NOT REGISTER");
        req.session.error = 'That email is already in use, please try a different one.'; //inform user could not log them in
        done(null, user);
      }
    })
    .fail(function (err){
      console.log(err.body);
    });
  }
));


//===============EXPRESS================
// Configure Express
app.use(logger('combined'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride('X-HTTP-Method-Override'));
app.use(session({secret: 'supernova', saveUninitialized: true, resave: true}));

app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

// Session-persisted message middleware
app.use(function(req, res, next){
  var err = req.session.error,
      msg = req.session.notice,
      success = req.session.success;

  delete req.session.error;
  delete req.session.success;
  delete req.session.notice;

  if (err) res.locals.error = err;
  if (msg) res.locals.notice = msg;
  if (success) res.locals.success = success;

  next();
});


// Configure express to use handlebars templates
var hbs = exphbs.create({
    defaultLayout: 'main', 
    helpers: {
        highlight: function(value) {
          console.log(value);
          
          return JSON.parse(value);
        }
        
    }
});
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');


//===============ROUTES=================

//displays our homepage
app.get('/', function(req, res){
  res.render('home', {user: req.user});
});

//displays our signup page
app.get('/signin', function(req, res){
  res.render('signin');
});

//sends the request through our local signup strategy, and if successful takes user to homepage, otherwise returns then to signin page
app.post('/local-reg', passport.authenticate('local-signup', {
  successRedirect: '/',
  failureRedirect: '/local-reg'
  })
);

//sends the request through our local login/signin strategy, and if successful takes user to homepage, otherwise returns then to signin page
app.post('/login', passport.authenticate('local-signin', { 
  successRedirect: '/',
  failureRedirect: '/signin'
  })
);

app.get('/local-reg', function(req, res){
  res.render('register', {user: req.user});
});

//logs user out of site, deleting them from the session, and returns to homepage
app.get('/logout', function(req, res){
  var name = req.user.email;
  console.log("LOGGIN OUT " + req.user.email)
  req.logout();
  res.redirect('/');
  req.session.notice = "You have successfully been logged out " + name + "!";
});

// route middleware to make sure user is logged in
function isLoggedIn(req, res, next) {

  // if user is authenticated in the session, carry on
  if (req.isAuthenticated())
    return next();

  // if they aren't redirect them to the home page
  res.redirect('/');
}


//Forgot passwords routes
app.get('/forgot', function(req, res) {
  res.render('forgot', {
    user: req.user
  });
});

app.post('/forgot', function(req, res, next) {
  async.waterfall([
    function(done) {
      crypto.randomBytes(20, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function(token, done) {
      // User.findOne({ email: req.body.email }, function(err, user) {
        funct.findUser(req.body.email)
      .then(function (user) {
        if (!user) {
          req.flash('error', 'No account with that email address exists.');
          return res.redirect('/forgot');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = (Date.now() + 3600000); // 1 hour
       
        // user.save(function(err) {
        //   done(err, token, user);
        // });

        funct.updateUser(user)
        .then(function (user,err) { 
          console.log("2. Changed user token");
          //console.log("User Details: " +user.resetPasswordToken+" "+ user.resetPasswordExpires +" "+user.email+" "+user.user_id);
          done(err, user.resetPasswordToken, user);
        });
        
      });
      
    },
    function(token, user, done) {
      console.log('sending email');
      var smtpTransport = nodemailer.createTransport('SMTP', {
        service: 'gmail',
        auth: {
            user: 'flexiprice@gmail.com',
            pass: 'flexi2015'
        }
      });

      var mailOptions = {
        from: 'passwordreset@FlexiPrice.com',
        to: user.email,
        subject: 'FlexiPrice Password Reset',
        text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'http://' + req.headers.host + '/reset?token=' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        done(err, 'done');
      });
    }
  ], function(err) {
    if (err) return next(err);
    
    res.redirect('/');
    req.session.notice = 'An e-mail has been sent to you with further instructions.';
  });
});

app.get('/reset', function(req, res) {
  //User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    var urlPart = url.parse(req.url, true);
    var query = urlPart.query;
    funct.findToken(query.token)
    .then(function (user) {
        if (!user) {
          console.log('Password reset token is invalid.');
          return res.redirect('/forgot');
        }
        if (Date.now() > user.resetPasswordExpires)
        {
          console.log('Password reset token has expired.');
          return res.redirect('/forgot');
        }
        //console.log("User Details: " +user.resetPasswordToken+" "+ user.resetPasswordExpires +" "+user.email+" "+user.user_id);
        res.render('reset', {
          user: req.user
        });

  });
});

app.post('/reset', function(req, res) {
  async.waterfall([
    function(done) {
      //User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        var urlPart = url.parse(req.url, true);
        var query = urlPart.query;
       
      funct.findToken(query.token)
      .then(function (user) {
        if (!user) {
          console.log('Password reset token is invalid or has expired.');
          return res.redirect('back');
        }
        if (Date.now() > user.resetPasswordExpires)
        {
          console.log('Password reset token has expired.');
          return res.redirect('/forgot');
        }
        // console.log("User Details: " +user.resetPasswordToken+" "+ user.resetPasswordExpires +" "+user.email+" "+user.user_id);
        // console.log("New Password: "+req.body.password);
        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        // user.save(function(err) {
        //   req.logIn(user, function(err) {
        //     done(err, user);
        //   });
        // });

        funct.updateUser(user)
        .then(function (user,err) { 
          console.log("3. Changed user token");
          //console.log("User Details: " +user.resetPasswordToken+" "+ user.resetPasswordExpires +" "+user.email+" "+user.user_id);
          done(err, user);
        });
      });
    },
    function(user, done) {
      var smtpTransport = nodemailer.createTransport('SMTP', {
        service: 'gmail',
        auth: {
            user: 'flexiprice@gmail.com',
            pass: 'flexi2015'
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'passwordreset@FlexiPrice.com',
        subject: 'Your password has been changed',
        text: 'Hello,\n\n' +
          'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        req.flash('success', 'Success! Your password has been changed.');
        req.session.notice = 'Success! Your password has been changed.';
        
        done(err);
      });
    }
  ], function(err) {
    res.redirect('/');
    req.session.notice = 'Success! Your password has been changed.';
  });
});

// === Experiments related routes ===
//Experiments page
app.get('/Experiments', isLoggedIn, function(req, res){
  console.log("User id: " + req.user.user_id);

  funct.getExperiments(req.user.user_id)
    .then(function (itemsList) {
      if (itemsList) {
         console.log("Items length:" + itemsList.length);
         //console.log (itemsList);
          res.render('Experiments/experiments', {user: req.user, items: itemsList});
        done(null, itemsList);
      }
      if (!itemsList) {
        console.log("COULD NOT FIND");
        done(null, itemsList);
      }
    })
    .fail(function (err){
      console.log("**** Error: " + err.body);
    });
 
});

//Go to -> Add new experiment page
app.get('/NewExperiment', isLoggedIn, function(req, res){
 funct.getCategories(req.user.user_id)
    .then(function (itemsList) {
      if (itemsList) {
         console.log("Items length:" + itemsList.length);
         //console.log (itemsList);
          res.render('Experiments/addNewExperiment', {user: req.user, items: itemsList});
        done(null, itemsList);
      }
      if (!itemsList) {
        console.log("COULD NOT FIND");
        done(null, itemsList);
      }
    })
    .fail(function (err){
      console.log("**** Error: " + err.body);
    });
});

//Submit new experiment
app.post('/SubmitExperiment' , isLoggedIn, function(req, res){
  console.log(req.user.user_id);
  funct.newExperiment(req.body.name, req.body.description, req.body.PrivateOnOffSwitch, req.body.survaypage, req.body.Categories, req.body.PriceOnOffSwitch, req.body.points, req.user.user_id, req.body.BidOnOffSwitch, req.body.MinPriceOnOffSwitch, req.body.wallet);
  res.writeHead(301,
    {Location: '/Experiments'}
  );
  res.end();
});


//Modify experiment : needs experiment details, categories, experiment iterations
app.get('/ModifyExperiment:id' , isLoggedIn, function(req, res){
  var id = (req.params.id).replace(/[^0-9]/g, ''); ;
  console.log("experiment_id: " + id);
  funct.getExperiment(id)
    .then(function (itemsList) {
      if (itemsList) {
         console.log("Items length:" + itemsList.length);
        funct.getCategories(req.user.user_id)
        .then(function (categoriesList) {
          if (categoriesList) {
             console.log("Items length:" + categoriesList.length);
             console.log (categoriesList);

              funct.getIterations(id)
              .then(function (iterations) {
                if (iterations) {
                   res.render('Experiments/modifyExperiment', {user: req.user, items: itemsList, categories:categoriesList, iterations:iterations});
                   done(null, itemsList, categoriesList, iterations);
                }
                if (!iterations) {
                  console.log("COULD NOT FIND");
                  done(null, iterations);
                }
                    })
            .fail(function (err){
              console.log("**** Error: " + err.body);
            });
             
            done(null, itemsList, categoriesList);
          }
          if (!categoriesList) {
            console.log("COULD NOT FIND");
            done(null, categoriesList);
          }
        })
        .fail(function (err){
          console.log("**** Error: " + err.body);
        });
        done(null, itemsList);
      }
      if (!itemsList) {
        console.log("COULD NOT FIND");
        done(null, itemsList);
      }
    })
    .fail(function (err){
      console.log("**** Error: " + err.body);
    });
});

//Submit new experiment
app.post('/SubmitModifiedExperiment:experiment_id' , isLoggedIn, function(req, res){
  console.log(req.user.user_id);
  var id = (req.params.experiment_id).replace(/[^0-9]/g, ''); ;
  console.log("experiment_id: " + id);
  console.log("link: "+req.body.share_link);
  funct.updateExperiment(req.body.name, req.body.description, req.body.PrivateOnOffSwitch, req.body.survaypage, req.body.Categories, req.body.PriceOnOffSwitch, req.body.points, req.user.user_id, req.body.BidOnOffSwitch, req.body.MinPriceOnOffSwitch, req.body.wallet, id, req.body.share_link, req.body.share_token);
  res.writeHead(301,
    {Location: '/Experiments'}
  );
  res.end();
});

//Delete experiment
app.get('/DeleteExperiment:experiment_id' , isLoggedIn, function(req, res){
  console.log(req.user.user_id);
  var id = (req.params.experiment_id).replace(/[^0-9]/g, ''); ;
  console.log("experiment_id: " + id);
  funct.deleteExperiment(id);
  res.writeHead(301,
    {Location: '/Experiments'}
  );
  res.end();
});

// === Categories related routes ===
//Categories page
app.get('/Categories', isLoggedIn, function(req, res){
  console.log("User id: " + req.user.user_id);

  funct.getCategories(req.user.user_id)
    .then(function (itemsList) {
      if (itemsList) {
         console.log("Items length:" + itemsList.length);
         console.log (itemsList);
          res.render('Categories/categories', {user: req.user, items: itemsList});
        done(null, itemsList);
      }
      if (!itemsList) {
        console.log("COULD NOT FIND");
        done(null, itemsList);
      }
    })
    .fail(function (err){
      console.log("**** Error: " + err.body);
    });
});


//Go to -> Add new category page
app.get('/NewCategory', isLoggedIn, function(req, res){
   res.render('Categories/addNewCategory', {user: req.user});
});

//Submit new category
app.post('/SubmitCategory' , isLoggedIn, function(req, res){
  console.log(req.user.user_id);
  funct.newCategory(req.body.name, req.body.message, req.user.user_id)
      .then(function (item) {
      if (item) {
         console.log("Items length:" + item.length);
         console.log (item);
         res.writeHead(301,
            {Location: '/addNewProduct:'+item[0].category_id}
          );
          res.end();

        done(null, item);
      }
      if (!item) {
        console.log("COULD NOT FIND");
        done(null, item);
      }
    })
    .fail(function (err){
      console.log("**** Error: " + err.body);
    });
});

//Modify category - need Category details + products related to category
app.get('/ShowCategory:id' , isLoggedIn, function(req, res){
  var id = (req.params.id).replace(/[^0-9]/g, ''); ;
  console.log("category_id: " + id)

  funct.getCategory(id)
    .then(function (itemsList) {
      if (itemsList) {
         console.log("Items length:" + itemsList.length);
         console.log (itemsList);

        funct.getProducts(id)
            .then(function (productsList) {
              if (productsList) {
                 console.log("Items length:" + productsList.length);
                 console.log (productsList);
                 res.render('Categories/showCategory', {user: req.user, items: productsList, category:itemsList});
                 done(null, productsList, itemsList);
              }
              if (!productsList) {
                 console.log("COULD NOT FIND");
                done(null, productsList);
              }
            })
            .fail(function (err){
              console.log("**** Error: " + err.body);
             });

        done(null, itemsList);
      }
      if (!itemsList) {
        console.log("COULD NOT FIND");
        done(null, itemsList);
      }
    })
    .fail(function (err){
      console.log("**** Error: " + err.body);
    });
});

//Delete Categort
app.get('/DeleteCategory:category_id', isLoggedIn, function(req, res){
  console.log(req.user.user_id);
  var cat_id = (req.params.category_id).replace(/[^0-9]/g, ''); 
  console.log("category_id: " + cat_id);
  funct.deleteCategory(cat_id);
  res.writeHead(301,
    {Location: '/Categories'}
  );
  res.end();
});

//Add new product page
app.get('/addNewProduct:id', isLoggedIn, function(req, res){
  console.log("User id: " + req.user.user_id);

  var id = (req.params.id).replace(/[^0-9]/g, ''); ;
  console.log("category_id: " + id);

    funct.getCategory(id)
    .then(function (itemsList) {
      if (itemsList) {
         console.log("Items length:" + itemsList.length);
         console.log (itemsList);
          res.render('Categories/addNewProduct', {user: req.user, category: itemsList});
        done(null, itemsList);
      }
      if (!itemsList) {
        console.log("COULD NOT FIND");
        done(null, itemsList);
      }
    })
    .fail(function (err){
      console.log("**** Error: " + err.body);
    });
});

//Submit new product
app.post('/SubmitProduct:id' , isLoggedIn, function(req, res){
  console.log(req.user.user_id);
   var id = (req.params.id).replace(/[^0-9]/g, ''); ;
  console.log("product_id: " + id);

  funct.newProduct(req.body.name, req.body.message, req.body.price, req.body.MinPrice, req.body.webpage, req.body.file_url, req.body.productType, id);

  res.writeHead(301,
    {Location: '/ShowCategory:' + id}
  );
  res.end();
});

//Update product
app.post('/ModifyProduct:product_id/:category_id' , isLoggedIn, function(req, res){
  console.log(req.user.user_id);
  var id = (req.params.product_id).replace(/[^0-9]/g, ''); 
  var cat_id = (req.params.category_id).replace(/[^0-9]/g, ''); 
  console.log("product_id: " + id);
 
  funct.updateProduct(req.body.name, req.body.message, req.body.price, req.body.MinPrice, req.body.webpage, req.body.file_url, req.body.productType, id);
 
  res.writeHead(301,
    {Location: '/ShowCategory:' + cat_id}
  );
  res.end();
});

//Delete product
app.get('/DeleteProduct:product_id/:category_id' , isLoggedIn, function(req, res){
  console.log(req.user.user_id);
  var id = (req.params.product_id).replace(/[^0-9]/g, '');
  var cat_id = (req.params.category_id).replace(/[^0-9]/g, ''); 
  console.log("product_id: " + id);
  funct.deleteProduct(id, cat_id);
  res.writeHead(301,
    {Location: '/ShowCategory:' + cat_id}
  );
  res.end();
});

//Modify product - need Category details + products related to category
app.get('/ShowProduct:product_id' , isLoggedIn, function(req, res){
  var product_id = (req.params.product_id).replace(/[^0-9]/g, ''); 
  console.log("product_id: " + product_id)
  funct.getProduct(product_id)
    .then(function (productsList) {
      if (productsList) {
         console.log("Items length:" + productsList.length);
         console.log (productsList);

          funct.getCategory(productsList[0].category_id)
              .then(function (itemsList) {
                if (itemsList) {
                   console.log("Items length:" + itemsList.length);
                   console.log (itemsList);
         res.render('Categories/modifyProduct', {user: req.user, product:productsList, category:itemsList});
                  done(null, itemsList, productsList);
                }
                if (!itemsList) {
                  console.log("COULD NOT FIND");
                  done(null, itemsList, productsList);
                }
              })
              .fail(function (err){
                console.log("**** Error: " + err.body);
              });
      }
      if (!productsList) {
         console.log("COULD NOT FIND");
        done(null, productsList);
      }
    })
    .fail(function (err){
      console.log("**** Error: " + err.body);
     });

});

//Amazon S3 bucket - file uploading
app.get('/sign_s3', isLoggedIn, function(req, res){
    aws.config.update({accessKeyId: AWS_ACCESS_KEY, secretAccessKey: AWS_SECRET_KEY});
    var s3 = new aws.S3();
    var s3_params = {
        Bucket: S3_BUCKET,
        Key: req.query.file_name,
        Expires: 60,
        ContentType: req.query.file_type,
        ACL: 'public-read'
    };
    s3.getSignedUrl('putObject', s3_params, function(err, data){
        if(err){
            console.log(err);
        }
        else{
            var return_data = {
                signed_request: data,
                url: 'https://'+S3_BUCKET+'.s3.amazonaws.com/'+req.query.file_name
            };
            res.write(JSON.stringify(return_data));
            res.end();
        }
    });
});

//Running Experiment!!!!!
app.get('/experimentWelcomePage', function(req, res){
  var urlPart = url.parse(req.url, true);
  var query = urlPart.query;
  //var id = (req.params.id).replace(/[^0-9]/g, ''); ;
  console.log("experiment_id: " + query.exp_id + ", iteration_id " + query.iteration_id);
 res.render('RunningExperiment/experimentWelcomePage', {layout: false, experimentId:query.exp_id, iteration_id: query.iteration_id});
});

//Submit and start Experiment!!!!!
app.post('/SubmitToExperiment', function(req, res){
  console.log("Experimenter name: " + req.body.name);
 //var id = (req.params.experimentId).replace(/[^0-9]/g, ''); ;
 var urlPart = url.parse(req.url, true);
  var query = urlPart.query;
  console.log("experiment_id: " + query.exp_id + ", iteration_id " + query.iteration_id);

  res.writeHead(301,
    {Location: '/experiment?exp_id='+query.exp_id+"&iteration_id="+query.iteration_id+"&name="+req.body.name}
  );
 
  res.end();
});

//Running Experiment!!!!!
app.get('/experiment', function(req, res){
  
  //var id = (req.params.experimentId).replace(/[^0-9]/g, ''); ;
  var urlPart = url.parse(req.url, true);
  var query = urlPart.query;
   console.log("experiment_id: " + query.exp_id + ", iteration_id " + query.iteration_id);
  console.log("Experimenter name: " + query.name);
    funct.getRunningExperiment(query.exp_id)
    .then(function (itemsList) {
      if (itemsList) {
         console.log("Items length:" + itemsList.length);
         //console.log (itemsList);
         var body;
        fs.readFile(__dirname +'/views/RunningExperiment/experimentstart.handlebars', function (err, data) {
          if (err) throw err;
          body = data;
          body += itemsList[0].gizmo_code;

          fs.readFile(__dirname +'/views/RunningExperiment/experimentend.handlebars', function (err, data1) {
            if (err) throw err;
            body += data1;
          
            var path = "views/public/experiment"+query.exp_id+".handlebars";
            fs.writeFile(path, body, function(err) {
                console.log("Writing file");
                if(err) {
                    return console.log(err);
                }
                console.log("The file was saved!");
                res.render("public/experiment"+query.exp_id, {layout: false, details: itemsList,experimentId:query.exp_id, iteration_id: query.iteration_id, name:query.name});
            });

          });
          
        });
        done(null, itemsList);
      }
      if (!itemsList) {
        console.log("COULD NOT FIND");
        done(null, itemsList);
      }
    })
    .fail(function (err){
      console.log("**** Error: " + err.body);
    });
});

//Submitting iteration data
app.post('/iterationSubmit', function(req, res){

  var details = req.body;
  
  console.log("Number of questions: " + details.numOfquestions+" "+ details.grade +" "+details["question_array[0][min_price]"] +" "+ details["question_array[1][subjective_price][]"]);

  funct.iterationDetails(req.body);
  res.send(req.body);
  
});

//Export to Excel
// app.get('/Excel', function(req, res){
//   var urlPart = url.parse(req.url, true);
//   var query = urlPart.query;
//   var iteration_id = query.iterationId;

// //iteration_id,userId, name, grade, balance, question_title, 
// //answer, product_name, min_price, subjective_price, paid_price, reveled_price, rating 
//     var conf={}
//     conf.cols=[
//         {
//             caption:'Iteration ID',
//             type:'string',
//             width:10
//         },
//         {
//             caption:'User ID',
//             type:'string',
//             width:10
//         },
//                 {
//             caption:'Name',
//             type:'string',
//             width:50
//         },
//         {
//             caption:'Grade',
//             type:'number',
//             width:4
//         },
//         {
//             caption:'Balance',
//             type:'number',
//             width:4
//         },
//         {
//             caption:'Question Title',
//             type:'string',
//             width:50
//         },
//         {
//             caption:'Answer',
//             type:'string',
//             width:50
//         },
//         {
//             caption:'Product Name',
//             type:'string',
//             width:50
//         },       
//         {
//             caption:'Min Price',
//             type:'number',
//             width:4
//         },
//         {
//             caption:'Subjective Price',
//             type:'string',
//             width:10
//         },
//         {
//             caption:'Paid Price',
//             type:'number',
//             width:4
//         },
//         {
//             caption:'Revealed Price',
//             type:'number',
//             width:4
//         },
//         {
//             caption:'Rating',
//             type:'string',
//             width:50
//         }];


//         funct.getIterationsDetails(iteration_id)
//             .then(function (itemsList) {
//               if (itemsList) {
//                   console.log("Items length:" + itemsList.length);
//                   //console.log(itemsList[0]);
//                   arr=[];
//                   for(i=0;i<itemsList.length;i++){
//                       iteration_id =itemsList[i].iteration_id;
//                       grade = itemsList[i].grade;
//                       balance = itemsList[i].balance;
//                       name = itemsList[i].name;
//                       userId = itemsList[i].user_id;
//                       min_price = itemsList[i].min_price;
//                       subjective_price = (itemsList[i].subjective_price).replace(/['"]+/g, '');
//                       revealed_price = itemsList[i].revealed_price;
//                       paid_price = itemsList[i].paid_price;
//                       question_title = (itemsList[i].question_title).substring(1, (itemsList[i].question_title).length-1);
//                       product_name = (itemsList[i].product_name).substring(1, (itemsList[i].product_name).length-1);
//                       answer = (itemsList[i].answer).substring(1, (itemsList[i].answer).length-1);
//                       rating = (itemsList[i].rating).substring(1, (itemsList[i].rating).length-1);

//                       a=[iteration_id,userId, name, grade, balance, question_title, answer, product_name, min_price, subjective_price, paid_price, reveled_price, rating ];
//                       arr.push(a);
//                   }
                  
// // .replace(/[^0-9]/g, '')

//                   conf.rows=arr;
//                   console.log(conf.rows);
//                   var result = nodeExcel.execute(conf);
//                   res.setHeader('Content-Type', 'application/vnd.openxmlformats');
//                   res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
//                   res.end(result, 'binary');
//                  done(null,itemsList);
//               }
//               if (!itemsList) {
//                  console.log("COULD NOT FIND");
//                 done(null, itemsList);
//               }
//             })
//             .fail(function (err){
//               console.log("**** Error: " + err.body);
//              });
// });

app.get('/Excel', isLoggedIn, function(req, res){
  var urlPart = url.parse(req.url, true);
  var query = urlPart.query;
  var iteration_id = query.iterationId;
  var tries = 3;
//iteration_id,userId, name, grade, balance, question_title, 
//answer, product_name, min_price, subjective_price, paid_price, reveled_price, rating 
    var conf={}
    conf.cols=[
        {
            caption:'Iteration ID',
            type:'string',
            width:10
        },
        {
            caption:'User ID',
            type:'string',
            width:10
        },
                {
            caption:'Name',
            type:'string',
            width:50
        },
        {
            caption:'Grade',
            type:'number',
            width:4
        },
        {
            caption:'Balance',
            type:'number',
            width:4
        },
        {
            caption:'Question Title',
            type:'string',
            width:50
        },
        {
            caption:'Answer',
            type:'string',
            width:50
        },
        {
            caption:'Product Name',
            type:'string',
            width:50
        },       
        {
            caption:'Min Price',
            type:'number',
            width:4
        },
        {
            caption:'Paid Price',
            type:'number',
            width:4
        },
        {
            caption:'Revealed Price',
            type:'number',
            width:4
        },
        {
            caption:'Rating',
            type:'string',
            width:50
        }];

        for(var i=0 ; i<tries ; i++){
         conf.cols.push( {
            caption:'Subjective Price',
            type:'number',
            width:10
          });
        }

        console.log(conf.cols);

        funct.getIterationsDetails(iteration_id)
            .then(function (itemsList) {
              if (itemsList) {
                  console.log("Items length:" + itemsList.length);
                  //console.log(itemsList[0]);
                  arr=[];
                  for(i=0;i<itemsList.length;i++){
                      iteration_id =itemsList[i].iteration_id;
                      grade = itemsList[i].grade;
                      balance = itemsList[i].balance;
                      name = itemsList[i].name;
                      userId = itemsList[i].user_id;
                      min_price = itemsList[i].min_price;
                      subjective_price = (itemsList[i].subjective_price).replace(/['"]+/g, '');
                      revealed_price = itemsList[i].revealed_price;
                      paid_price = itemsList[i].paid_price;
                      question_title = (itemsList[i].question_title).substring(1, (itemsList[i].question_title).length-1);
                      product_name = (itemsList[i].product_name).substring(1, (itemsList[i].product_name).length-1);
                      answer = (itemsList[i].answer).substring(1, (itemsList[i].answer).length-1);
                      rating = (itemsList[i].rating).substring(1, (itemsList[i].rating).length-1);


                      subjective_price = subjective_price.substring(1, (subjective_price).length-1);
                      subjectiveArray = subjective_price.split(',');
                      a=[iteration_id,userId, name, grade, balance, question_title, answer, product_name, min_price, paid_price, revealed_price, rating ];
                      
                      for(var j=0 ; j<subjectiveArray.length ; j++){
                        console.log(subjectiveArray[j]);
                        a.push(subjectiveArray[j]);
                      }
                      
                      arr.push(a);
                  }
                  
                  conf.rows=arr;
                  console.log(conf.rows);
                  var result = nodeExcel.execute(conf);
                  res.setHeader('Content-Type', 'application/vnd.openxmlformats');
                  res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
                  res.end(result, 'binary');
                 done(null,itemsList);
              }
              if (!itemsList) {
                 console.log("COULD NOT FIND");
                done(null, itemsList);
              }
            })
            .fail(function (err){
              console.log("**** Error: " + err.body);
             });
});


//===============PORT=================
var port = process.env.PORT || 5000; //select your port or let it pull from your .env file
app.listen(port);
console.log("listening on " + port + "!");