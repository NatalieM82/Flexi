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

var path = require('path');

var AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
var AWS_SECRET_KEY = process.env.AWS_SECRET_KEY;
var S3_BUCKET = process.env.S3_BUCKET;





//We will be creating these two files shortly
 var funct = require('./functions.js'); //funct file contains our helper functions for our Passport and database work

var app = express();
app.use('/includes',express.static(path.join(__dirname, 'includes')));
app.use('/images',express.static(path.join(__dirname, 'images')));
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

// Configure express to use handlebars templates
var hbs = exphbs.create({
    defaultLayout: 'main', 
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
  failureRedirect: '/signin'
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
  //name, description, privateExp, embbedCode, category, showPrices, tries, user_idNew, openNegotiation, useMinPrice, wallet
  funct.newExperiment(req.body.name, req.body.description, req.body.PrivateOnOffSwitch, req.body.survaypage, req.body.Categories, req.body.PriceOnOffSwitch, req.body.points, req.user.user_id, req.body.BidOnOffSwitch, req.body.MinPriceOnOffSwitch, req.body.wallet);
  //res.render('Experiments/experiments', {user: req.user});
  res.writeHead(301,
    {Location: '/Experiments'}
  );
  res.end();
});


//Modify experiment : needs experiment details, categories, experiment iterations
app.get('/ModifyExperiment:id' , function(req, res){
  var id = (req.params.id).replace(/[^0-9]/g, ''); ;
  console.log("experiment_id: " + id)
  funct.getExperiment(id)
    .then(function (itemsList) {
      if (itemsList) {
         console.log("Items length:" + itemsList.length);
        // console.log (itemsList);
        // res.render('Experiments/modifyExperiment', {user: req.user, items: itemsList}); 
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

//Submit new category
app.post('/SubmitProduct:id' , function(req, res){
  console.log(req.user.user_id);
   var id = (req.params.id).replace(/[^0-9]/g, ''); ;
  console.log("category_id: " + id);

  console.log(req.user.user_id);
  funct.newProduct(req.body.name, req.body.message, req.body.price, req.body.MinPrice, req.body.webpage, req.body.file_url, req.body.productType, id);
  //res.render('Experiments/experiments', {user: req.user});
  res.writeHead(301,
    {Location: '/ShowCategory:' + id}
  );
  res.end();
});

//Modify category - need Category details + products related to category
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

        // res.render('Categories/modifyProduct', {user: req.user, product:productsList});
         //done(null, productsList);
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
 res.render('experimentWelcomePage', {layout: false, experimentId:id});
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
app.get('/experiment:experimentId', function(req, res){
  
  var id = (req.params.experimentId).replace(/[^0-9]/g, ''); ;
  console.log("experiment_id: " + id);
  
    funct.getRunningExperiment(id)
    .then(function (itemsList) {
      if (itemsList) {
         console.log("Items length:" + itemsList.length);
         console.log (itemsList);

         // res.writeHead(301,
         //    {Location: '/experiment:'+itemsList}
         //  );
         // res.json({ detail: itemsList })
         //  res.end();

          res.render('experiment', {layout: false, details: itemsList});
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