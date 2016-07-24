import * as path from 'path';
import { StringHelpers } from '../../Tools/StringHelpers';
import { ImportGeneratorContext } from '../Contexts/ImportGeneratorContext';

export class ImportGenerator {

	private static ImportTpl = "{0}import { {1} } from '{2}';";
	private static refTpl = "/// <reference path=\"{1}\" />{0}";

	public static Generate(context: ImportGeneratorContext): string {
		if (context.isReferenceType) {
			return StringHelpers.format(this.refTpl, context.newLine, context.moduleDirectory);
		}
		else if (context.declaringElements) {
			let length = context.declaringElements.end - context.declaringElements.pos;
			let currentImport = context.sourceFile.getFullText().substr(context.declaringElements.pos, length);
			let toInsert = ', ' + context.nodeToResolve;
			let offset = context.insertAtOffset;
			
			return [currentImport.slice(0, offset), toInsert, currentImport.slice(offset, length)].join(''); 
		}
		else {
			return StringHelpers.format(this.ImportTpl, context.newLine, context.nodeToResolve, context.moduleDirectory);
		}
	}

}