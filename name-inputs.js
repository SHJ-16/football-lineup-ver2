(() => {
  const baseRender = render;
  render = () => {
    baseRender();
    layer.querySelectorAll('.player-token').forEach((token, index) => {
      const oldName = token.querySelector('.player-name');
      if (!oldName) return;
      const input = document.createElement('input');
      input.className = 'player-name-input';
      input.value = players[index].name;
      input.maxLength = 12;
      input.setAttribute('aria-label', `${players[index].pos} player name`);
      input.addEventListener('dragstart', event => event.stopPropagation());
      input.addEventListener('input', () => {
        players[index].name = input.value || 'Name';
        const cardName = list.children[index]?.querySelector('strong');
        if (cardName) cardName.textContent = players[index].name;
      });
      input.addEventListener('change', render);
      oldName.replaceWith(input);
      token.querySelector('.player-pos').after(input);
    });
  };
  render();
})();
