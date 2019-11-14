console.clear();

function requestEventLoopFrame(cb) {
    return setTimeout(cb, 0);
}


/** 
 * Code listing view.  
 * Exposes methods for population and line highlighting.
**/
var CodeView = (function() {

    var myEl, codeLines, codeLineEls;

    // Init the module.
    // @param el - HTMLElement for display
    // @param codeText - string of code to display
    function init(el, codeText) {
        myEl = el;
        if (codeText) setCode(codeText);
    }

    // Populate the listing
    // @param codeText - string of code to display
    function setCode(codeText) {
        myEl.innerHTML = '';
        codeLines = codeText.split('\n');
        codeLines.forEach(function(line, idx) {
            var lineNum = idx + 1;

            var lineEl = document.createElement('div');
            lineEl.classList.add('code-line');
            lineEl.dataset.lineNum = lineNum;

            var lineNumEl = document.createElement('span');
            lineNumEl.classList.add('code-line-num');
            lineNumEl.textContent = lineNum;
            lineEl.appendChild(lineNumEl);

            var lineNumText = document.createElement('span');
            lineNumText.classList.add('code-line-text');
            lineNumText.textContent = line || ' ';
            lineEl.appendChild(lineNumText);

            myEl.appendChild(lineEl);
        });

        codeLineEls = myEl.querySelectorAll('.code-line');
    }

    // Highlight a range of lines
    // @param start - int of starting line
    // @param end - int of end line, inclusive
    // @param doNotClear - bool to retain existing highlights if true
    function selectLine(start, end, doNotClear) {
        if (!doNotClear) clearSelection();
        var s = start - 1 || 0,
            e = (end === undefined) ? s : end - 1;
        for (var i = s; i <= e; i++) {
            codeLineEls[i].classList.add('selected');
        }
    }

    // Clears all current highlights
    function clearSelection() {
        for (var i = 0; i < codeLineEls.length; i++) {
            codeLineEls[i].classList.remove('selected');
        }
    }

    return {
        init: init,
        setCode: setCode,
        selectLine: selectLine,
        clearSelection: clearSelection
    };

})();

/** 
 * Stack view.  
 * Exposes methods for push, pop & clear.
**/
var StackView = (function() {

    var myEl, stackItems = [],
        stackItemEls;

    // Inits the module.
    // @param el - HTMLElement of stack view
    // @param items - array/string of item(s) to init with
    function init(el, items) {
        myEl = el;
        clearStack();
        if (items) pushToStack(items);
    }

    // Clears the entire stack
    function clearStack() {
        myEl.textContent = '';
        stackItems = [];
    }

    // Push onto the stack
    // @param items - array/string of item(s)
    function pushToStack(items) {
        if (typeof items === 'string') items = [items];
        items.forEach(function(item) {
            stackItems.push(item);
            var itemEl = document.createElement('li');
            itemEl.classList.add('stack-item');
            itemEl.classList.add('stack-item-pushed');
            itemEl.textContent = item;
            myEl.appendChild(itemEl);
        });
        stackItemEls = myEl.querySelectorAll('.stack-item');
    }

    // Pops the topmost item off the stack
    function popFromStack() {
        console.log(stackItems);
        var lastIdx = stackItems.length - 1;
        var item = stackItems.pop();
        stackItemEls[lastIdx].classList.remove('stack-item-pushed');
        requestEventLoopFrame(function() {
            stackItemEls[lastIdx].classList.add('stack-item-popped');
        });
        setTimeout(function() {
            myEl.removeChild(stackItemEls[lastIdx]);
        }, 450);
        return item;
    }

    return {
        init: init,
        push: pushToStack,
        pop: popFromStack,
        clear: clearStack
    };

})();

/** 
 * Console view.  
 * Exposes a log method.
**/
var ConsoleView = (function() {

    var myEl;

    // Init the module.
    // @param el - HTMLElement to log into
    function init(el) {
        myEl = el;
    };

    // Logging function.
    // @param msg - string to log
    function log(msg) {
        myEl.textContent += msg + '\n';
    }

    return {
        init: init,
        log: log
    }

})();

/** 
 * Module to sequence the various steps in the example
 * flow.  Exposes methods for init and advancing the flow.
**/
var Sequencer = (function() {

    /**
     {
        lineStart: 0,
        lineEnd: 0,
        pushes: [],
        numPops: 0,
        log: '',
        desc: ''
     }
    **/

    var myEl, stepData, currentStep;

    function init(steps, pageEl) {
        if (pageEl) myEl = pageEl;
        stepData = steps;
        currentStep = 0;
        doCurrentStep();
    }

    function next() {
        if (currentStep === stepData.length - 1) return;
        currentStep++;
        doCurrentStep();
    }

    function doCurrentStep() {
        step = stepData[currentStep];
        if (step.lineStart) CodeView.selectLine(step.lineStart, step.lineEnd);
        if (step.pushes) StackView.push(step.pushes);
        if (step.numPops) {
            for (var i = 0; i < step.numPops; i++) {
                StackView.pop();
            }
        }
        if (step.log) ConsoleView.log(step.log);

        if (myEl) myEl.textContent = 'Step ' + (currentStep + 1) + ' of ' + stepData.length;
    }

    return {
        init: init,
        next: next
    }
})();

/** 
 * Main program
**/
(function() {

    // Grab the code lisitng from our script tag
    var sampleCode = document.getElementById('example-code').textContent;

    // Init our display modules
    CodeView.init(document.querySelector('#view-code .inner'), sampleCode);
    StackView.init(document.querySelector('#view-stack .inner'), ['main()']);
    ConsoleView.init(document.querySelector('#view-console .inner'));

    // Init the step sequencer
    var FLOW = [{
        lineStart: 15
    }, {
        lineStart: 10,
        pushes: 'solid()'
    }, {
        lineStart: 11
    }, {
        lineStart: 5,
        pushes: 'liquid()'
    }, {
        lineStart: 6,
    }, {
        lineStart: 1,
        pushes: 'add()'
    }, {
        lineStart: 2
    }, {
        lineStart: 6,
        numPops: 1
    }, {
        lineStart: 7
    }, {
        pushes: 'console.log()'
    }, {
        numPops: 1,
        log: 'Snaaaake! 4'
    }, {
        lineStart: 11,
        numPops: 1
    }, {
        lineStart: 12
    }, {
        pushes: 'console.log()'
    }, {
        numPops: 1,
        log: 'Brother!'
    }, {
        lineStart: 15,
        numPops: 1
    }];
    Sequencer.init(FLOW, document.getElementById('pagination'));

    // Bind the Next button
    var nextBut = document.getElementById('next');
    var disabled = false;
    nextBut.addEventListener('click', function() {
        if (disabled) return false;
        disabled = true;
        Sequencer.next();
        nextBut.classList.add('disabled');
        setTimeout(function() {
            nextBut.classList.remove('disabled');
            disabled = false;
        }, 1500);
    }, false);

})();