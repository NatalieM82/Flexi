// // functions.js/
var Q = require('q');
var mysql      = require('mysql');
var pool = mysql.createPool({
  host     : 'flexiprice.ch60q2dhrwiy.us-west-2.rds.amazonaws.com',
  user     : 'flexiprice',
  password : 'flexi2015',
  database : 'flexiprice',
});


//used in local-signup strategy
exports.localReg = function (usernameNew, passwordNew) {
  var deferred = Q.defer();
  post = { username: usernameNew, password: passwordNew, avatar:"http://upload.wikimedia.org/wikipedia/commons/d/d3/User_Circle.png"};
  var user;

  pool.getConnection(function (err, connection) {
    connection.query('INSERT INTO flexiprice.researchers SET ?', post, function (err, result) {
      if (err != null) {
        console.log(err);
        console.log("Username already in use");
       
        deferred.resolve(false);
      }
      if (err == null) {                           
        connection.query('SELECT * FROM flexiprice.researchers where username = \"' + usernameNew + '\";' ,function(err, rows, fields) {
          if (err!= null) {
            console.log("Error finding user" + err);
          }

          if (err == null) {
            for (var i in rows) {
              console.log(rows.username +" "+ rows[i].password +" "+ rows[i].user_id);
              user = {
               "username": rows[i].username,
               "password": rows[i].password,
               "user_id": rows[i].user_id,
               "avatar": "http://upload.wikimedia.org/wikipedia/commons/d/d3/User_Circle.png"
             }
             deferred.resolve(user);
           }
         }
             connection.end();
       });
      }
      connection.end();
    });

  });

  return deferred.promise;
};

exports.localAuth = function (usernameNew, passwordNew) {
  var deferred = Q.defer();

  var user;

  pool.getConnection(function (err, connection) {
   connection.query('SELECT * FROM flexiprice.researchers where username = \"' + usernameNew + '\";' ,function(err, rows, fields) {
    if (err!= null) {
      console.log("Error finding user" + err);
       deferred.reject(new Error(err.body));
    }

    if (err == null) {
      for (var i in rows) {
        console.log(rows[i].username +" "+ rows[i].password +" "+ rows[i].user_id);
        if (passwordNew == rows[i].password) {
         user = {
           "username": rows[i].username,
           "password": rows[i].password,
           "user_id": rows[i].user_id,
           "avatar": rows[i].avatar
         }
         deferred.resolve(user);
       } else {
        console.log("PASSWORDS NOT MATCH");
      
        deferred.resolve(false);
      }
    }
  }
      connection.end();
});
 });
  return deferred.promise;
}

//INSERT INTO `flexiprice`.`experiments` (`user_id`, `category_id`, `experiment_name`, `experiment_desc`, `creation_date`, `last_modified`, `survey_link`, `show_prices`, `open_negotiation`, `use_min_price`, `private`, `active`) 
//VALUES ('1', '1', 'hello', 'something', '12/04/15', '15/04/15', 'link.com', '1', '0', '0', '0', '1');
exports.newExperiment = function (name, description, privateExp, embbedCode, category, showPrices, tries, user_idNew, openNegotiation, useMinPrice, wallet) {
  console.log("==== Adding new experiment ====");
  console.log(name + " " + description + " " + privateExp + " " + category + " " + showPrices  + " " + tries  + " " +  openNegotiation + " " + useMinPrice + " " + wallet);

  if (!privateExp) {
    privateExp = 'off';
  }

  if (!showPrices) {
    showPrices = 'off';
  }

  if (!openNegotiation) {
    openNegotiation = 'off';
  }

  if (!useMinPrice) {
    useMinPrice = 'off';
  }

  if(!tries) {
    tries = 0;
  }

  var today = getTodayDate();

  var post = {
    user_id: user_idNew,
    category_id: category,
    experiment_name: name,
    experiment_desc : description,
    creation_date: today,
    last_modified: today,
    gizmo_code: embbedCode,
    show_prices: showPrices,
    open_negotiation: openNegotiation,
    use_min_price: useMinPrice,
    private: privateExp,
    active: '1',
    max_tries: tries,
    starting_wallet: wallet
  }

  pool.getConnection(function (err, connection){
    connection.query('INSERT INTO flexiprice.experiments SET ?', post, function (err, result) {
      if (err != null) {
        console.log(err);
      }
      if (err == null) {                           

      }
          connection.end();
    });
  });

}

function getTodayDate() {
  var today = new Date();
   var dd = today.getDate();
   var mm = today.getMonth()+1; //January is 0!
   var yyyy = today.getFullYear();

   if(dd<10) {
       dd='0'+dd
   } 

   if(mm<10) {
       mm='0'+mm
  } 

  today = dd+'/'+mm+'/'+yyyy;

  return today;
}

exports.getExperiments = function (user_id) {
  var deferred = Q.defer();
 
   pool.getConnection(function (err, connection) {
   var sql = 'SELECT * FROM flexiprice.experiments where user_id=?;'
     connection.query(sql, user_id , function (err, rows) {
    if (err!= null) {
      console.log("Error finding experiments" + err);
    }

    if (err == null) {
         deferred.resolve(rows);
       }  
       connection.end();
    
    });
   });

  return deferred.promise;
}

exports.getExperiment = function (wanted) {
  var deferred = Q.defer();
  console.log("experiment_id: " + wanted)
   pool.getConnection(function (err, connection) {
   var sql = 'SELECT * FROM flexiprice.experiments where experiment_id=?;'
     connection.query(sql, wanted , function (err, rows) {
    if (err!= null) {
      console.log("Error finding experiments" + err);
    }

    if (err == null) {
         console.log(rows[0].experiment_name);
         deferred.resolve(rows);
       }  
       connection.end();
    
    });
   });

  return deferred.promise;
}


exports.getCategories = function (user_id) {
  var deferred = Q.defer();
 
   pool.getConnection(function (err, connection) {
   var sql = 'SELECT * FROM flexiprice.categories where user_id=?;'
     connection.query(sql, user_id , function (err, rows) {
    if (err!= null) {
      console.log("Error finding categories" + err);
      deferred.reject(new Error(err.body));
    }

    if (err == null) {
         deferred.resolve(rows);
       }  
       connection.end();
    
    });
   });

  return deferred.promise;
}


//INSERT INTO `flexiprice`.`categories` (`user_id`, `active`, `category_name`, `products_number`, `category_desc`) 
//VALUES ('4', '1', 'Category2', '0', 'Something');
exports.newCategory = function (name, description, user_idNew) {
  var deferred = Q.defer();
  console.log("==== Adding new category ====");
  console.log(name + " " + description + " " + user_idNew);

  var post = {
    user_id: user_idNew,
    category_name: name,
    category_desc : description,
    active: '1',
    products_number: '0'
  }

  pool.getConnection(function (err, connection){
    connection.query('INSERT INTO flexiprice.categories SET ?', post, function (err, result) {
      if (err != null) {
        console.log(err);
        deferred.reject(new Error(err.body));
      }
      if (err == null) {                           
          console.log(result.insertId);
              var lastId = result.insertId;
              var category = exports.getCategory(lastId);
              deferred.resolve(category);

      }
          connection.end();
    });
  });
 return deferred.promise;
}

exports.getCategory = function (wanted) {
  var deferred = Q.defer();
  console.log("category_id: " + wanted)
   pool.getConnection(function (err, connection) {
   var sql = 'SELECT * FROM flexiprice.categories where category_id=?;'
     connection.query(sql, wanted , function (err, rows) {
    if (err!= null) {
      console.log("Error finding category" + err);
    }

    if (err == null) {
       
         deferred.resolve(rows);
       }  
       connection.end();
    
    });
   });

  return deferred.promise;
}

exports.getProducts = function (category_id) {
  var deferred = Q.defer();
 
   pool.getConnection(function (err, connection) {
   var sql = 'SELECT * FROM flexiprice.products where category_id=?;'
     connection.query(sql, category_id , function (err, rows) {
    if (err!= null) {
      console.log("Error finding products" + err);
      deferred.reject(new Error(err.body));
    }

    if (err == null) {
         deferred.resolve(rows);
       }  
       connection.end();
    
    });
   });

  return deferred.promise;
}

exports.getProduct = function (wanted) {
  var deferred = Q.defer();
  console.log("Product_id: " + wanted)
   pool.getConnection(function (err, connection) {
   var sql = 'SELECT * FROM flexiprice.products where product_id=?;'
     connection.query(sql, wanted , function (err, rows) {
    if (err!= null) {
      console.log("Error finding product" + err);
    }

    if (err == null) {
         deferred.resolve(rows);
       }  
       connection.end();
    
    });
   });

  return deferred.promise;
}


//INSERT INTO `flexiprice`.`products` (`category_id`, `description`, `type`, `name`, `value`) 
//VALUES ('2', 'something', 'url', 'Product1', '20');
//req.body.name, req.body.message, req.body.price, req.body.MinPrice, req.body.webpage, req.body.file_url, req.body.productType, id
exports.newProduct = function (name, description, value, min_price, url, file_url, type, category_id) {
  console.log("==== Adding new Product ====");
  console.log(name + " " + description + " " + value + " " + min_price + " " + category_id);

 var final_url;
  if (url == null && file_url != "")
  {
    final_url = file_url;
  }


  if (url != null && file_url == "")
  {
    final_url = url;
  }
    console.log("Link: " +url+" File: " + file_url + " Final:" +final_url);

  var post = {
    category_id: category_id,
    name: name,
    description : description,
    value: value,
    type: type,
    path:final_url, 
    min_price: min_price
  }

 

  pool.getConnection(function (err, connection){
    connection.query('INSERT INTO flexiprice.products SET ?', post, function (err, result) {
      if (err != null) {
        console.log(err);

      }
      if (err == null) {                           
        exports.updateCategory(category_id);
          console.log(result.insertId);

          var post2 = {
           path:final_url, 
           product_id:result.insertId
          }
        
        // connection.query('INSERT INTO flexiprice.files SET ?', post2, function (err, result) {
        //   if (err != null) {
        //     console.log(err);
        //   }
        //   if (err == null) {                           
        //   }
             
        // });
      }
          connection.end();
    });
  });

}

exports.updateCategory = function (wanted) {
  console.log("==== Updating category ====");
  pool.getConnection(function (err, connection){
      var sql = 'UPDATE flexiprice.categories SET products_number=products_number+1 WHERE category_id=?;'
     connection.query(sql, wanted , function (err, rows) {
      if (err != null) {
        console.log(err);
      }
      if (err == null) {                           

      }
          connection.end();
    });
  });

}

//SELECT * FROM experiments INNER JOIN products ON experiments.category_id = products.category_id And experiments.experiment_id = 12;

exports.getRunningExperiment = function (experiment_id) {
  var deferred = Q.defer();
 
   pool.getConnection(function (err, connection) {
   var sql = 'SELECT * FROM experiments INNER JOIN products ON experiments.category_id = products.category_id And experiments.experiment_id =?;'
     connection.query(sql, experiment_id , function (err, rows) {
    if (err!= null) {
      console.log("Error finding running experiment" + err);
      deferred.reject(new Error(err.body));
    }

    if (err == null) {
         deferred.resolve(rows);
       }  
       connection.end();
    
    });
   });

  return deferred.promise;
}

exports.getIterations = function (experiment_id) {
  var deferred = Q.defer();
 
   pool.getConnection(function (err, connection) {
   var sql = 'SELECT * FROM flexiprice.iterations where experiment_id=?;'
     connection.query(sql, category_id , function (err, rows) {
    if (err!= null) {
      console.log("Error finding iterations" + err);
      deferred.reject(new Error(err.body));
    }

    if (err == null) {
         deferred.resolve(rows);
       }  
       connection.end();
    
    });
   });

  return deferred.promise;
}

