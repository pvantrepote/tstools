
export interface ICommand {
	
	name: string;
	execute() : Thenable<void>;

}