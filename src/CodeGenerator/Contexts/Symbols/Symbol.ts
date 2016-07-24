import * as path from 'path';


export enum SymbolType {
	isClass,
	isInterface
}

export class Symbol {
	relativePath: string;
	type: SymbolType;
	moduleName: string;
	hasNamespace: boolean;

	constructor(type?: SymbolType, relativePath?: string, hasNamespace?: boolean) {
		if ((type == undefined) || !relativePath) {
			return;
		}
		
		let parsedPath = path.parse(relativePath);

		this.hasNamespace = hasNamespace;
		this.type = type;
		this.moduleName = parsedPath.name;
		this.relativePath = path.join('./', parsedPath.dir, this.moduleName);
	}
}
