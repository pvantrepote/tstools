# TsTools

Set of TypeScript tools for Visual Studio Code. 

## IDE Feature

![IDE](http://i.giphy.com/l46Cugpupotvp3S9y.gif)

![IDE](http://i.giphy.com/26gLwUcGn8uMT2eNa.gif)

## Using

First, you will need to install Visual Studio Code. In the command palette (`cmd-shift-p`) select `Install Extension` and choose `TsTools`.  

## Commands

* `Implement` Implement interfaces or properties
* `Import` Import dependencies

## Known Issues

Implement interface works only for explicit interface import (import { MyInterface } from '...')

## Release Notes

### 1.0.0

* Initial release of Implement interfaces and properties.

### 1.0.1

* Use of the tsconfig for compiler options.
* New command shortcut. CMD+SHIFT+I on OS X, CTRL+SHIFT+I on Windows
* Update README

### 1.0.2

* Adding keywords for marketplace

### 1.1.0

* Adding support for namespace
* Adding import

## License
[MIT](LICENSE)