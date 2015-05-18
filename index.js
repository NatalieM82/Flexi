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
    TwitterStrategy = require('passport-twitter'),
    GoogleStrategy = require('passport-google'),
    FacebookStrategy = require('passport-facebook'),
    aws = require('aws-sdk');

var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

var path = require('path');
var fs = require('fs');

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
  console.log("serializing " + user.username);
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  console.log("deserializing " + obj);
  done(null, obj);
});

// Use the LocalStrategy within Passport to login/”signin” users.
passport.use('local-signin', new LocalStrategy(
  {passReqToCallback : true}, //allows us to pass back the request to the callback
  function(req, username, password, done) {
    funct.localAuth(username, password)
    .then(function (user) {
      if (user) {
        console.log("LOGGED IN AS: " + user.username);
        req.session.success = 'You are successfully logged in ' + user.username + '!';
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
passport.use('local-signup', new LocalStrategy(
  {passReqToCallback : true}, //allows us to pass back the request to the callback
  function(req, username, password, done) {
    funct.localReg(username, password)
    .then(function (user) {
      if (user) {
        console.log("REGISTERED: " + user.username);
        req.session.success = 'You are successfully registered and logged in ' + user.username + '!';
        done(null, user);
      }
      if (!user) {
        console.log("COULD NOT REGISTER");
        req.session.error = 'That username is already in use, please try a different one.'; //inform user could not log them in
        done(null, user);
      }
    })
    .fail(function (err){
      console.log(err.body);
    });
  }
));

passport.use(new GoogleStrategy({
    clientID: "47362818163-ih40bkgdk8inev800ctgivrn58hbtu82.apps.googleusercontent.com",
    clientSecret: "eMMBybTbj7ISKoNlld75AYRv",
    callbackURL: "http://flexiprice.herokuapp.com/auth/google/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return done(err, user);
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

// Handlebars.helper('highlight', function(value, options) {
//   var escaped = Handlebars.Utils.escapeExpression(value);
//   return new Ember.Handlebars.SafeString('<span class="highlight">' + escaped + '</span>');
// });

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

app.get('/auth/google',
  passport.authenticate('google', { scope: 'https://www.googleapis.com/auth/plus.login' }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/signin' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
  });

// //Default route
// app.all('*', function(req,res, next) {
//   console.log("Running first!");
//   console.log(req.user);
//   if(req.user == "undefined") {
//      res.writeHead(200,
//       {Location: '/signin'}
//     );
//   }
// });

// //Default route
// app.all('*', function(req,res, next) {
//   console.log("Running first!");
//   console.log(req.user);
//   next();
// });

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
  var name = req.user.username;
  console.log("LOGGIN OUT " + req.user.username)
  req.logout();
  res.redirect('/');
  req.session.notice = "You have successfully been logged out " + name + "!";
});

// === Experiments related routes ===
//Experiments page
app.get('/Experiments', function(req, res){
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
app.get('/NewExperiment', function(req, res){
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
app.post('/SubmitExperiment' , function(req, res){
  console.log(req.user.user_id);
  funct.newExperiment(req.body.name, req.body.description, req.body.PrivateOnOffSwitch, req.body.survaypage, req.body.Categories, req.body.PriceOnOffSwitch, req.body.points, req.user.user_id, req.body.BidOnOffSwitch, req.body.MinPriceOnOffSwitch, req.body.wallet);
  res.writeHead(301,
    {Location: '/Experiments'}
  );
  res.end();
});


//Modify experiment : needs experiment details, categories, experiment iterations
app.get('/ModifyExperiment:id' , function(req, res){
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
              res.render('Experiments/modifyExperiment', {user: req.user, items: itemsList, categories:categoriesList});
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
app.post('/SubmitModifiedExperiment:experiment_id' , function(req, res){
  console.log(req.user.user_id);
  var id = (req.params.experiment_id).replace(/[^0-9]/g, ''); ;
  console.log("experiment_id: " + id);
  funct.updateExperiment(req.body.name, req.body.description, req.body.PrivateOnOffSwitch, req.body.survaypage, req.body.Categories, req.body.PriceOnOffSwitch, req.body.points, req.user.user_id, req.body.BidOnOffSwitch, req.body.MinPriceOnOffSwitch, req.body.wallet, id);
  res.writeHead(301,
    {Location: '/Experiments'}
  );
  res.end();
});

//Delete experiment
app.get('/DeleteExperiment:experiment_id' , function(req, res){
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
app.get('/Categories', function(req, res){
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
app.get('/NewCategory', function(req, res){
   res.render('Categories/addNewCategory', {user: req.user});
});

//Submit new category
app.post('/SubmitCategory' , function(req, res){
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
app.get('/ShowCategory:id' , function(req, res){
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
app.get('/DeleteCategory:category_id' , function(req, res){
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
app.get('/addNewProduct:id', function(req, res){
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
app.post('/SubmitProduct:id' , function(req, res){
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
app.post('/ModifyProduct:product_id/:category_id' , function(req, res){
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
app.get('/DeleteProduct:product_id/:category_id' , function(req, res){
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
app.get('/ShowProduct:product_id' , function(req, res){
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
app.get('/sign_s3', function(req, res){
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
app.get('/experimentWelcomePage:id', function(req, res){
  var id = (req.params.id).replace(/[^0-9]/g, ''); ;
  console.log("experiment_id: " + id);
 res.render('RunningExperiment/experimentWelcomePage', {layout: false, experimentId:id});
});

//Running Experiment!!!!!
app.post('/SubmitToExperiment:experimentId', function(req, res){
  console.log("Experimenter name: " + req.body.name);
 var id = (req.params.experimentId).replace(/[^0-9]/g, ''); ;
         res.writeHead(301,
            {Location: '/experiment:'+id}
          );
          res.end();
});



//Running Experiment!!!!!
// app.get('/experiment:experimentId', function(req, res){
  
//   var id = (req.params.experimentId).replace(/[^0-9]/g, ''); ;
//   console.log("experiment_id: " + id);
  
//     funct.getRunningExperiment(id)
//     .then(function (itemsList) {
//       if (itemsList) {
//          console.log("Items length:" + itemsList.length);
//          //console.log (itemsList);
//           // var path = "public/experiment"+id+".js";
//           // var path2 = "/experiment"+id+".js";

//           // fs.writeFile(path, itemsList[0].gizmo_code, function(err) {
//           //     console.log("Writing file");
//           //     if(err) {
//           //         return console.log(err);
//           //     }
//           //     console.log("The file was saved!");
//           // }); 

//         res.render('experiment', {layout: false, details: itemsList, gizmoCodeL: itemsList[0].gizmo_code});
//         done(null, itemsList);
//       }
//       if (!itemsList) {
//         console.log("COULD NOT FIND");
//         done(null, itemsList);
//       }
//     })
//     .fail(function (err){
//       console.log("**** Error: " + err.body);
//     });
// });

//Running Experiment!!!!!
app.get('/experiment:experimentId', function(req, res){
  
  var id = (req.params.experimentId).replace(/[^0-9]/g, ''); ;
  console.log("experiment_id: " + id);
  
    funct.getRunningExperiment(id)
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
            // app.locals({
            //     details: itemsList
            // });

            //**res.send(body);
            //res.render(body, {layout: false, details: itemsList, gizmoCodeL: itemsList[0].gizmo_code});
            var path = "views/public/experiment"+id+".handlebars";
            fs.writeFile(path, body, function(err) {
                console.log("Writing file");
                if(err) {
                    return console.log(err);
                }
                console.log("The file was saved!");
                res.render("public/experiment"+id, {layout: false, details: itemsList});
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


//===============PORT=================
var port = process.env.PORT || 5000; //select your port or let it pull from your .env file
app.listen(port);
console.log("listening on " + port + "!");