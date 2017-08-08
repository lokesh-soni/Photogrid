module.exports = function(express, app, formidable, fs, os, gm, knoxClient, mongoose, io) {

var Socket;

io.on('connection', function(socket){
	Socket = socket;
})

var singleImage = new mongoose.Schema({
	filename:String,
	votes:Number
})

var singleImageModel = mongoose.model('singleImage', singleImage);

var router = express.Router();

router.get('/', function(req, res, next){
	res.render('index', {host:app.get('host')})
})

router.post('/upload', function(req, res, next){
	//File Upload
	console.log('uploading');
	function generateFilename(filename){
		var ext_regex = /(?:\.([^.]+))?$/;
		var ext = ext_regex.exec(filename)[1];
		var date = new Date().getTime();
		var charBank = "qwertyuioplkjhgfdsazxcvbnm";
		var fstring = '';
		for(var i = 0; i < 15; i++){
			fstring += charBank[parseInt(Math.random()*26)];
		}
		return (fstring += date + '.' + ext);
	}

	var tmpFile, nfile, fname;
	var newForm = new formidable.IncomingForm();
		newForm.keepExtensions = true;
		newForm.parse(req,function(err, fields, files){
			tmpFile = files.upload.path;
			fname = generateFilename(files.upload.name);
			nfile = os.tmpDir() + '/' + fname;
			console.log('writing');
			res.writeHead(200, {'Content-type':'text/plain'});
			res.end();
		})

		newForm.on('end', function(){
			fs.rename(tmpFile, nfile, function(){
				console.log('b4 resize');
				//Resize the image and upload in s3
				gm(nfile).resize(300).write(nfile, function(){
					console.log('in resize');
					fs.readFile(nfile, function(err, buf){
						var req = knoxClient.put(fname, {
							'Content-Length':buf.length,
							'Content-Type':'image/jpeg'
						})

						req.on('response', function(res){
							if(res.statusCode == 200){
								// This means that the file is in the S3 Bucket !	
								var newImage = new singleImageModel({
									filename:fname,
									votes:0
								}).save();

								Socket.emit('status', {'msg':'Saved !!', 'delay': 3000});
								Socket.emit('doUpdate', {});
								console.log('after emit');
								//Delete the local file
								fs.unlink(nfile, function(){
									console.log('Local file deleted !');
								})
						
							}
							else {
								console.log('this means that the file is not being uploaded');
							}
						})

						req.end(buf);
					})
				});
			})
		})
})

app.use('/', router);
}