var dataList;
var createdTriggers = ['master'];
var previousElementTrigger = 'master';
var bypassTypes = ['DML_END','METHOD_ENTRY','METHOD_EXIT','CONSTRUCTOR_ENTRY','CONSTRUCTOR_EXIT', 'SOQL_EXECUTE_END', 'FLOW_INTERVIEW_FINISHED'];
let startFilters = ['CODE_UNIT_STARTED',
'METHOD_ENTRY',
'SOQL_EXECUTE_BEGIN',
'DML_BEGIN',
'CALLOUT_REQUEST',
'CONSTRUCTOR_ENTRY',
'FLOW_CREATE_INTERVIEW_END',
'EXCEPTION_THROWN',
'FATAL_ERROR',
'USER_DEBUG'];
let endFilters = ['SOQL_EXECUTE_END','DML_END','CALLOUT_RESPONSE','CODE_UNIT_FINISHED','METHOD_EXIT','CONSTRUCTOR_EXIT','FLOW_INTERVIEW_FINISHED'];
let treePoint = {'uid':0, 'opDetails': 'Start Execution', 'opStart': 0, 'opRes':'','isIO':'code', 'raw': 'Start Execution', 'toView' :true,'parent':null,'trigger':'master', 'children' : [],'wrap':false}
let eltsById={};

function generate(orders) {
  var myTemplateConfig = {
    colors: ["#979797", "#0090b8", "#f7c400"],
    branch: {
      lineWidth: 3,
      spacingX: 35,
      showLabel: true,
      labelColor: 'transparent'
    },
    commit: {
      spacingY: -20,
      dot: {
        size: 4,
        strokeColor: 'red'
      },
      message: {
        displayAuthor: true,
        displayBranch: false,
        displayHash: false,
        font: "normal 12pt Arial"
      },
      tooltipHTMLFormatter: function(commit) {
        let message = '';
        
        message += commit.message;
        return message;
      }
    }
  };
  var myTemplate = new GitGraph.Template(myTemplateConfig);

  /***********************
   *    INITIALIZATION   *
   ***********************/

  var config = {
    template: myTemplate,
    orientation: "horizontal"
    // mode: "compact"
  };
  var gitGraph = new GitGraph(config);

  // Custom events
  gitGraph.canvas.addEventListener("commit:mouseover", function(event) {
    this.style.cursor = "pointer";
  });

  gitGraph.canvas.addEventListener("commit:mouseout", function(event) {
    this.style.cursor = "auto";
  });

  var master = gitGraph.branch("Execution");
  var branches = [];
  branches['master'] = master;

  try {

    for (var i = 0; i < orders.length; i++) {
      let order = orders[i];

      if (order.action === 'branch') {
        if (order.opts.parentBranch === 'gitGraph')
          order.opts.parentBranch = gitGraph;

        branches[order.newBranch] = branches[order.branch].branch(order.opts);
      }
      if (order.action === 'merge') {
        branches[order.branch].merge(branches[order.newBranch], order.opts);
      }

      if (order.action === 'checkout') {
        branches[order.branch].checkout();
      }

      if (order.action === 'commit') {
        branches[order.branch].commit(order.opts);
      }
    }

    document.getElementById("analyze").disabled = false;
    document.getElementById('spinner').style.display = 'none';
  } catch (error) {
    console.log(error);
    document.getElementById("analyze").disabled = false;
    document.getElementById('spinner').style.display = 'none';
  }

}

function browseGraph(elt){

  let orders = [];
  let message = '';
  if(elt.opTime){
    message += '(<i>'+elt.opTime+' ms</i>) ';
  }
  if(elt.rows > 0){
    message += '<b>[';
    message += elt.rows > 1 ? 'Records' : 'Record';
    message += ': ' + elt.rows + ']</b> ';
  }
  message += elt.opType ? elt.opType + ' | ' + elt.opDetails : elt.opDetails;

  var opts = {
    message: message
  };

  if(!bypassTypes.includes(elt.opType)){
    if(elt.isTriggerEvent){
      if(elt.opType == 'CODE_UNIT_STARTED'){
        // New trigger
        if(!createdTriggers.includes(elt.trigger)){
          let parentBranch = 'master';
          if(elt.parent && elt.parent.trigger){
            parentBranch = elt.parent.trigger
          }
          orders.push({
            newBranch: elt.trigger,
            branch: parentBranch,
            action: 'branch',
            opts: {
              parentBranch: 'gitGraph',
              name: elt.trigger
            }
          });
          orders.push({
            branch: elt.trigger,
            action: 'checkout',
            message: ''
          });
          orders.push({
            branch: elt.trigger,
            action: 'commit',
            opts: {
              message: message,
              dotStrokeWidth: 3,
              dotColor: "green",
              dotStrokeColor: "green"
            }
          });
          createdTriggers.push(elt.trigger);
        }else{
          // Change to an existing trigger
          if(elt.trigger != previousElementTrigger){
            orders.push({
              branch: elt.parent.trigger,
              newBranch: elt.trigger,
              action: 'merge',
              opts: {
                message: message,
                parentBranch: 'gitGraph',
                name: elt.trigger,
                dotStrokeWidth: 3,
                dotColor: "green",
                dotStrokeColor: "green"
              }
            });
          }else{
            orders.push({
              branch: elt.trigger,
              action: 'commit',
              opts: {
                message: message,
                parentBranch: 'gitGraph',
                name: elt.trigger,
                dotStrokeWidth: 3,
                dotColor: "green",
                dotStrokeColor: "green"
              }
            });
          }
        }
      }else{
        // End current trigger
        orders.push({
          branch: elt.trigger,
          action: 'commit',
          opts: {
            message: message,
            dotStrokeWidth: 3,
            dotColor: "red",
            dotStrokeColor: "red"
          }
        });
        orders.push({
          branch: elt.parent.trigger,
          newBranch: elt.trigger,
          action: 'merge',
          opts: {
            message: message,
            parentBranch: 'gitGraph',
            name: elt.trigger,
            dotStrokeWidth: 3,
            dotColor: "red",
            dotStrokeColor: "red"
          }
        });
      }
      
    }else{
      let customizedOpts = opts;

      switch (elt.opType){
        case 'DML_BEGIN':
          customizedOpts = {
            message: message,
            dotStrokeWidth: 4,
            dotColor: "black",
            dotStrokeColor: "rgba(0,0,0,1)"
          };
          break;

        case 'SOQL_EXECUTE_BEGIN':
          let colorDot = "rgba(158,158,158,0.2)";
          let strokeColor = "rgba(158,158,158,0.8)";
          if(elt.rows > 0){
            colorDot = "white";
            strokeColor = "black";
          }
          customizedOpts = {
            message: message,
            dotStrokeWidth: 1,
            dotColor: colorDot,
            dotStrokeColor: strokeColor
          };

          break;
      }

      if(elt.trigger != previousElementTrigger){
        orders.push({
          newBranch: elt.trigger,
          branch: previousElementTrigger,
          action: 'merge',
          opts: customizedOpts
        });
      }else{
        orders.push({
          branch: elt.trigger,
          action: 'commit',
          opts: customizedOpts
        });
      }
    }
    previousElementTrigger = elt.trigger;
  }

  if(elt.children && elt.children.length > 0){
    orders.push(...elt.children.flatMap(e=>browseGraph(e)));
  }
  
	return orders;
}

function printCallStack(elt){
	let wrap = false;
	if(endFilters.includes(elt.opType) && elt!==treePoint) return '';
	if(elt.hidden && elt!==treePoint) return '';
	if(elt.children.length>0){
		childStr = elt.children.map(e=>printCallStack(e)).join('');
		wrap = true;
	}
	if(elt.isIO) {
	outstr = `<li><span class="opinfo">[${elt.opStart}]${elt.opTime?elt.opTime+"ms":""} ${elt.opDetails} line ${elt.opRes}</span>`;
	}else{
		outstr = `<li><span class="opRes" ${wrap?`onclick="dowrap(${elt.uid})"`:""}>[${elt.opStart}]${elt.opTime?elt.opTime+"ms":""} ${elt.nbSOQL}soql ${elt.nbCO}co ${elt.nbDML}dml ${wrap?"[+]":""}</span><span class="${elt.isIO?'isIO':'code'}">${elt.opDetails} line ${elt.opRes}</span>`;

	}
	if(wrap) outstr += '<ul>' + childStr +  '</ul>';
	outstr += '</li>';
	return outstr;
}

function genGraph(logs){

	let nextID=0;

   	for(log of logs){
       
      let logParts = log.split('|');

      // ByPass
      if(logParts.length<3) continue;
      let opType = logParts[1];
      let timeStamp=logParts[0].slice(0,12);
      let timeDelta=logParts[0].slice(logParts[0].indexOf('(')+1,-1);
      let opStart = Math.trunc((timeDelta)/1000000);
      let lineNum=logParts[2]?logParts[2].slice(1,-1):'-';

      if(startFilters.includes(opType)){
        /* */
        let newPoint = {
          uid: ++nextID,
          opType: opType,
          opStart: opStart,
          timestamp: timeStamp,
          timeDelta: timeDelta,
          nbDML : (opType==='DML_BEGIN')?1:0,
          nbSOQL: (opType==='SOQL_EXECUTE_BEGIN')?1:0,
          nbCO  : (opType==='CALLOUT_REQUEST')?1:0,
          opRes : lineNum,
          rows: 0,
          raw: log,
          isTriggerEvent: false,
          children : []
        };
        if(lineNum != 'EXTERNAL')
          newPoint.lineNum = lineNum;

        newPoint.opDetails =  ((logParts[4])?logParts[4]:logParts[3]).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

        if(opType == 'SOQL_EXECUTE_BEGIN'){
          newPoint.rows = logParts[3].replace('Rows:', '').replace('Aggregations:', '');
        }
        if(opType=='CODE_UNIT_STARTED'){
          if(newPoint.opDetails.includes('trigger event')){
            newPoint.trigger = newPoint.opDetails.split(' ')[0];
            newPoint.isTriggerEvent = true;
          }
        }


        eltsById[nextID] = newPoint;
        newPoint.parent = treePoint;

        if(newPoint.trigger == null && newPoint.parent != null)
          newPoint.trigger = newPoint.parent.trigger;

        treePoint.children.push(newPoint);
        /* */


        if(['EXCEPTION_THROWN','FATAL_ERROR','USER_DEBUG'].includes(opType)){
          newPoint.opTime = 0;
        }else treePoint = newPoint;
        
      }
      if(endFilters.includes(opType)){

        /* Add new point like for start statements */
        let newPoint = {
          uid: ++nextID,
          opType: opType,
          timestamp: timeStamp,
          timeDelta: timeDelta,
          nbDML : (opType==='DML_BEGIN')?1:0,
          nbSOQL: (opType==='SOQL_EXECUTE_BEGIN')?1:0,
          nbCO  : (opType==='CALLOUT_REQUEST')?1:0,
          opRes : lineNum,
          rows: 0,
          raw: log,
          isTriggerEvent: false,
          children : []
        };
        eltsById[nextID] = newPoint;
        newPoint.parent = treePoint;

        if(opType=='CODE_UNIT_FINISHED'){
          if(logParts.length >= 3){
            newPoint.opDetails =  ((logParts[2])?logParts[2]:logParts[1]).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            if(newPoint.opDetails.includes('trigger event')){
              newPoint.trigger = newPoint.opDetails.split(' ')[0];
              newPoint.isTriggerEvent = true;
            }
          }
        }
        if(newPoint.trigger == null && newPoint.parent != null)
          newPoint.trigger = newPoint.parent.trigger;

        treePoint.children.push(newPoint);
        /* */


        treePoint.opTime = Math.trunc((timeDelta)/1000000) - treePoint.opStart;
        if(treePoint.isIO){
          treePoint.opRes += ', ' + bb[3];
          treePoint.containsIO = true;
        }
        if(treePoint.parent){
          treePoint.parent.nbSOQL += treePoint.nbSOQL;
          treePoint.parent.nbCO += treePoint.nbCO;
          treePoint.parent.nbDML += treePoint.nbDML;
          treePoint = treePoint.parent;
        }
      }
	  }
  
    let orders = browseGraph(treePoint);
	  //document.getElementById('treeroot').innerHTML = printCallStack(treePoint);

    return orders;
}

function dowrap(cmpid){
	children = eltsById[cmpid].children;
	numvisible = children.reduce((acc, curr)=>acc+(curr.hidden?0:1),0);
	if(numvisible===0){ // all elts hidden, show those longer than.. or with io
		for(let elt of children) elt.hidden=((!elt.containsIO)||(!viewIO));
		// for(let elt of children) elt.hidden=(elt.opTime<minTime) && ((!elt.containsIO)||(!viewIO));
	}else if(numvisible===children.length){ // all visible : hide all
		for(let elt of children) elt.hidden=true;
	}else{ // some visible : show all
		for(let elt of children) elt.hidden=false;
	}
	document.getElementById('treeroot').innerHTML = printCallStack(treePoint);
}

function readTheFile(thefile){
  document.getElementById("fileName").innerHTML = thefile.name;
  document.getElementById("fileName").style = 'margin-left: 0.5rem; margin-right: 0.75rem;';
	var reader = new FileReader();
	reader.onload = function(e) {
		let datList = reader.result;
    reader.result = null;
    dataList = datList;
	}
	reader.readAsText(thefile);  	
}

function parseLog() {
  createdTriggers = ['master'];
  previousElementTrigger = 'master';
  
  var logStr;
  if(dataList != null){
    logStr = dataList;
  }else{
    logStr = document.getElementsByTagName("textarea")[0].value;
  }

  document.getElementById('analyze').disabled = true;
  document.getElementById('spinner').style.display = 'block';

  let graph = genGraph(logStr.split("\n"));
  generate(graph);

  document.getElementById("analyze").disabled = false;
  document.getElementById('spinner').style.display = 'none';
}

(function() {

  var fileInput = document.getElementById('fileInput');
  fileInput.addEventListener('change', function(e) {
    var file = fileInput.files[0];
    readTheFile(file);
  });

  var htmlCanvas = document.getElementById('canvas');

  initialize();

  function initialize() {
    window.addEventListener('resize', resizeCanvas, false);

    resizeCanvas();
  }

  function redraw() {
    context.strokeStyle = 'blue';
    context.lineWidth = '5';
    context.strokeRect(0, 0, window.innerWidth, window.innerHeight);
  }

  function resizeCanvas() {
    htmlCanvas.width = window.innerWidth;
    htmlCanvas.height = window.innerHeight;
    // redraw();
  }

})();