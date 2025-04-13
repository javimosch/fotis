import ora from 'ora';

export function createSpinner(text) {
  return ora(text);
}

export function withSpinner(text, action) {
  const spinner = createSpinner(text);
  spinner.start();
  
  return action()
    .then(result => {
      spinner.succeed();
      return result;
    })
    .catch(error => {
      spinner.fail();
      throw error;
    })
    .finally(() => {
      if (spinner.isSpinning) spinner.stop();
    });
}