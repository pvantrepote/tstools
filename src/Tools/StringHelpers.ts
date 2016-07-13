

export class StringHelpers {

  public static format(value: string, ...args) {
    return value.replace(/{(\d+)}/g, function (match, number) {
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
        ;
    });
  }

  public static getWordAtOffset(value: string, offset: number): string {
    // Search for the word's beginning and end.
    let left = value.slice(0, offset + 1).search(/(?![, ]+)(\S)+$/g);
    let right = value.slice(offset).search(/[\s,{]/);

    // The last word in the string is a special case.
    if (right < 0) {
      return value.slice(left);
    }

    // Return the word, using the located bounds to extract it from the string.
    return value.slice(left, right + offset);
  }

}
