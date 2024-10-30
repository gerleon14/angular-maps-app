

export function isInt(value) {
	/** Check if value is integer
	Refs:
		https://stackoverflow.com/questions/14636536/how-to-check-if-a-variable-is-an-integer-in-javascript
		https://jsben.ch/htLVw
	**/
  var x;
  if (isNaN(value)) {
    return false;
  }
  x = parseFloat(value);
  return (x | 0) === x;
}