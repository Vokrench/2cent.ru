import fetch from 'node-fetch';
import fs from 'fs';
import {createRequire} from "module";

const require = createRequire(import.meta.url);
const cheerio = require('cheerio');
const AdmZip = require('adm-zip');
let sourcedir;

async function fetchurl(url) {
    let response = await fetch(url);
    let finres = await response.text();
    return finres;
}

async function main() {
    for (let i = 2; i < process.argv.length; i++){
        let url = process.argv[i];
        let resp = await fetchurl(url);
        let $ = cheerio.load(resp);
        let description = $('#tab-description > article').text();
        let firstjson = JSON.parse($('head > script[type="application/ld+json"]').html());
        let productname = firstjson.name;
        if (productname.includes("/") === true){
            productname = productname.replace(/[/]/g, "-");
        }
        let images = firstjson.image;
        let secondjson = JSON.parse($('body > main > div.product-variant-second.product-variant-tab-first.rs-zoom.rs-product > div.mb-6 > div > div > div.col > div > div.variant-product-options > script').html());
        let colors = secondjson.levels[0].values;
        let onlycolors = [];
        for (let item of colors) {
            onlycolors.push(item.text);
        }
        let availability = secondjson.offers[0].availableOn;
        if (availability === 1){
            availability = "yes"
        } else {
            availability = "no"
        }
        let cashprice = secondjson.offers[0].price;
        let cardprice = secondjson.offers[0].oldPrice;
        let productrating = $('#tab-comments > div > div.col-md-5.order-md-last > div > div.mb-4.d-flex.align-items-center > div.text-center.col-6 > div.product-rating__score').text();
        productrating = productrating.replace(/\n/g, "");
        sourcedir = './source'
        if (!fs.existsSync(sourcedir)){
            fs.mkdirSync(sourcedir);
        }
        let maindir = sourcedir + "/" + productname;
        if (!fs.existsSync(maindir)){
            fs.mkdirSync(maindir);
        }
        let gallerydir = maindir + "/gallery";
        if (!fs.existsSync(gallerydir)){
            fs.mkdirSync(gallerydir);
        }
        for (let j = 0; j < images.length; j++){
            await fetch(images[j]).then((resp) => resp.body.pipe(fs.createWriteStream(gallerydir + '/img' + j + '.png')) )
        }
        let jsonobj = JSON.parse("{}");
        jsonobj.url = url;
        jsonobj.name = productname;
        jsonobj.rating = productrating;
        jsonobj.reviews = [];
        let reviews = $('#tab-comments > div > div.col-md-7.mt-6 > div').find('.product-review-item').each(function(){
            let reviewrate = $(this).find('.rating-stars__act').attr('style')
            let score = (reviewrate.includes(100)) ? 5 : (reviewrate.includes(80)) ? 4 : (reviewrate.includes(60)) ? 3 : (reviewrate.includes(40)) ? 2 : (reviewrate.includes(20)) ? 1 : 0;
            let reviewtext = $(this).text().replace(/\s+/g, " ");
            jsonobj.reviews.push({rating:score,review:reviewtext});
        });
        jsonobj.pictures = images;
        jsonobj.description = description;
        jsonobj.feature = [];
        let properties = $('.product-chars').each((i, element) => {
            let category = $(element).prev('.mb-md-4').text();
            let props = [];
            let items = $(element).find('li').each(function() {
                let key = $(this).find('.col-sm-7').text().replace(/[?]/g,"").trim();
                let value = $(this).find('.col-sm-5').text().trim();
                props.push({[key]:value})
            });
            jsonobj.feature.push({ [category]: props.reduce((acc, obj) => ({ ...acc, ...obj }), {}) });
        });
        jsonobj.price = {cashprice:cashprice,cardprice:cardprice};
        jsonobj.availability = availability;
        jsonobj.colors = onlycolors;
        fs.writeFileSync(maindir + "/data.json", JSON.stringify(jsonobj));
    }
    function createzip(){
        let zip = new AdmZip();
        zip.addLocalFolder(sourcedir);
        zip.writeZip("output.zip");
        fs.rmSync(sourcedir, { recursive: true, force: true });
        console.log('Архив успешно создан!');
    }
    setTimeout(createzip, 5000);
}

main();