// Test file for SonarLint
const unusedVar = 42 // Should trigger S1481
console.log('test')

function test() {
  var x = 1 // Should trigger var usage warning
  return x
}
