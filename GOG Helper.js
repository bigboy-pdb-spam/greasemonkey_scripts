// ==UserScript==
// @name         GOG Helper
// @description  Alters how products are displayed
// @require      https://raw.githubusercontent.com/bigboy-pdb-spam/greasemonkey_scripts/master/config/GOG.conf.js
// @version      1.1.0
// @grant        GM.setClipboard
// @match        https://www.gog.com/
// @match        https://www.gog.com/*
// ==/UserScript==

// DEBUG
console.log('Greasemonkey: UserScript: GOG Helper');


//
// Validate variables in config file
//

// Validate 'uninterested' variable
if (typeof(uninterested) === 'undefined') {
  throw new Error("'uninterested' variable was not defined");
  
} else if (!Array.isArray(uninterested)) {
  throw new Error("'uninterested' variable is not an array");
}

for (let i=0; i < uninterested.length; i++) {
  if (typeof(uninterested[i]) !== 'number') {
    throw new Error(`'uninterested[${i}]' is not a number`);
  }
}

// Validate 'perhaps' variable
if (typeof(perhaps) === 'undefined') {
  throw new Error("'perhaps' variable was not defined");
  
} else if (typeof(perhaps) !== 'object') {
  throw new Error("'perhaps' variable is not an object");
}

let numRegex = new RegExp('^[0-9]\+$');
for (let id of Object.keys(perhaps)) {
  if (!numRegex.exec(id)) {
    throw new Error(`Key '${id}' in 'perhaps' is not a number`);
  } else if (typeof(perhaps[id]) !== 'number') {
    throw new Error(`'perhaps[${i}]' is not a number`);
  }
}

// Validate 'price_ranges' variable
function hasValidRange(o) {
  return typeof(o.start) === 'number' && typeof (o.end) === 'number' &&
   o.start <= o.end;
}

function hasRange(o) {
  return typeof(o.start) !== 'undefined' && typeof(o.end) !== 'undefined';
}

if (typeof(price_ranges) === 'undefined') {
  throw new Error("'price_ranges' variable was not defined");
  
} else if (!Array.isArray(price_ranges)) {
  throw new Error("'price_ranges' variable is not an array");
}

for (let i=0; i < price_ranges.length; i++) {
  if (typeof(price_ranges[i]) !== 'object') {
    throw new Error(`'price_ranges[${i}]' is not an object`);
    
  } else if (typeof(price_ranges[i].style) !== 'string') {
    throw new Error(`'price_ranges[${i}].style' must be a CSS style`);
    
  } else if (
   i === 0 && hasRange(price_ranges[i]) && !hasValidRange(price_ranges[i])
  ) {
    throw new Error(
     `'price_ranges[0]' must have either no range or a valid range`
    );
    
  } else if (i > 0 && !hasValidRange(price_ranges[i])) {
    throw new Error(`'price_ranges[${i}]' must have a valid range`);
  }
}


//
// Generate CSS selectors for the maximum price allowed
//


const range = (start, stop, step) =>
 Array.from({ length: (stop - start) / step + 1}, (_, i) => start + (i * step));


let price_range_styles = '';

for (const rnge of price_ranges) {
  let price_selector = '';

  // A starting or ending range was NOT specified
  if (!hasRange(rnge)) {
    price_range_styles += `[track-add-to-cart-price] { ${rnge.style} } `;
  }
  
  for (const num of range(rnge.start, rnge.end, 1)) {
    price_selector += (price_selector ? ', ' : '') +
     `[track-add-to-cart-price^="${num}."]`;
  }
  
  price_range_styles += `${price_selector} { ${rnge.style} } `;
}


//
// Convert list of games that I'm NOT interested in into a set
//

let uninterestedSet = new Set();

for (const id of uninterested) {
  uninterestedSet.add(id+'');
}


//
// Read product IDs and make appropriate chages to products
//

console.log(`Metal Slug X: ${perhaps['2046360890']}`);
let lastIdRead = '';

function readIds() {
  let intervalId;
  
  intervalId = setInterval(function() {
    console.log('Looking for: product IDs');
    
    let tiles = document.body.querySelectorAll('.product-tile');
    
    let allTilesLoaded = true;
    for (let tile of tiles) {
      let id = tile.getAttribute('product-tile-id');
      let lastId = tile.getAttribute('data-last-id');
      
      allTilesLoaded = allTilesLoaded && id && id !== lastId;
    }
    
    // The last product tile has NOT been read or it has NOT changed
    if (!allTilesLoaded) {
    //if (!lastId || lastId === lastIdRead) {
    	return;
    }
    clearInterval(intervalId);
    console.log('Found: product IDs');
    
    for (let tile of tiles) {
      // Remove old classes from the product
      tile.classList.remove('uninterested');
      tile.classList.remove('later');
      tile.classList.remove('reasonable');
    
      let id = tile.getAttribute('product-tile-id');
      let price = Number(tile.getAttribute('track-add-to-cart-price'));
      let reasonablePrice = Number(perhaps[id]);

      tile.setAttribute('data-last-id', id);
      
      // I'm not interested in the product
      if (uninterestedSet.has(id)) {
        tile.classList.add('uninterested');
        
      // I might purchase the prduct for a reasonable price
      } else if ((id in perhaps) && reasonablePrice) {
        tile.classList.add('later');
        
        // Price is reasonable
        if (price <= reasonablePrice) {
          tile.classList.add('reasonable');
        }
      }
    }
    
    console.log('Finished with: product IDs');
  }, 1500);
}
readIds();


//
// Event listeners
//

// Copy product id and title formatted as 'ID // TITLE' to the clipboard when a product is hovered over with the mouse
document.body.addEventListener('mousemove', (evt) => {
  // The mouse is not hovering over the cart button on a product
  if (!evt.target.matches('[class*="product-tile"]')) {
    return; // ABORT
  }
  
  let productTileElem = evt.target;
  while (productTileElem && !productTileElem.matches('[product-tile-id]')) {
    productTileElem = productTileElem.parentElement;
  }
  
  let product = {
    id: productTileElem.attributes['product-tile-id'].value - 0,
    price: productTileElem.attributes['track-add-to-cart-price'].value - 0,
    title: productTileElem.attributes['track-add-to-cart-title'].value
  };
  
  GM.setClipboard(`${product.id}, // ${product.title}`);
});


// The document body was clicked on
document.body.addEventListener('click', function(evt) {
  // A page number was clicked on (the page was changed)
  if (
   evt.target.classList.contains('page-index-wrapper') &&
   evt.target.classList.contains('page-indicator--inactive')
  ) {
    readIds();
  }
});


//
// Append styles to document body
//


document.body.insertAdjacentHTML('beforeend',
 `<style>
 /* Change visibility of games based on prices */

 ${price_range_styles}


 /* Change visibility of games that I might get later (and of those that are
  cheaper) */

 .later { background-color: purple; opacity: 0.2; }
 .later.reasonable { opacity: 1; }


 /* Hide DLCs, extra content, demos, and games that I am uninterested in */

 [track-add-to-cart-title~="dlc" i],
 [track-add-to-cart-title~="expansion" i],
 [track-add-to-cart-title~="upgrade" i],

 [track-add-to-cart-title~="OST" i],
 [track-add-to-cart-title~="soundtrack" i],
 
 [track-add-to-cart-title~="demo" i],
 [track-add-to-cart-title~="teaser" i],
 [track-add-to-cart-title~="prologue" i],
 
 .uninterested { opacity: 0.1; }
 </style>`
);

