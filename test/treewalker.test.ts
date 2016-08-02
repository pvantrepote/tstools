//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { TreeWalker } from './../src/CodeGenerator/Contexts/TreeWalker';


// Defines a Mocha test suite to group tests of similar kind together
suite("TreeWalker Tests", () => {

  test("Should return a newline", () => {
    let walker: TreeWalker = new TreeWalker();
    assert.equal(walker.newLine, (process.platform == 'windows') ? '\r\n' : '\n');
  });

  

});