var fs = require('fs');
eval(fs.readFileSync('../gesture-expressions.js').toString());

describe('The gesture expression parser', function() {

  describe('when parsing modifiers', function() {


    ///
    /// *
    ///

    it('recognizes `*` as the zero-or-more modifier', function() {
      var data = { string: '*', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(modifier.min).toBe(0);
      expect(modifier.max).toBe(Infinity);
    });

    it('eats `*` after parsing it', function() {
      var data = { string: '*', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(data.pos).toBe(1);
    });


    ///
    /// +
    ///
    
    it('recognizes `+` as the one-or-more modifier', function() {
      var data = { string: '+', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(modifier.min).toBe(1);
      expect(modifier.max).toBe(Infinity);
    });

    it('eats `+` after parsing it', function() {
      var data = { string: '+', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(data.pos).toBe(1);
    });


    /// 
    /// ?
    /// 
    
    it('recognizes `?` as the optional modifier', function() {
      var data = { string: '?', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(modifier.min).toBe(0);
      expect(modifier.max).toBe(1);
    });

    it('eats `?` after parsing it', function() {
      var data = { string: '?', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(data.pos).toBe(1);
    });


    ///
    /// n occurences exactly
    ///
    
    it('recognizes `{12}` to mean exactly 12 occurances of the previous expression', function() {
      var n = 12;
      var data = { string: '{' + n + '}', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(modifier.min).toBe(n);
      expect(modifier.max).toBe(n);
    });
    
    it('recognizes `{0}` to mean exactly 0 occurances of the previous expression', function() {
      var n = 0;
      var data = { string: '{' + n + '}', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(modifier.min).toBe(n);
      expect(modifier.max).toBe(n);
    });

    it('eats `{1234}` after parsing it', function() {
      var data = { string: '{1234}', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(data.pos).toBe(6);
    });

    it('fails on `{-12}` because `-12` is negative', function() {
      var data = { string: '{-12}', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(modifier).toBe(undefined);
      expect(data.hasError).toBe(true);
    });

    it('fails on `{13.3}` because `13.3` is not an integer', function() {
      var data = { string: '{13.3}', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(modifier).toBe(undefined);
      expect(data.hasError).toBe(true);
    });

    it('fails on `{12 }` because `12 ` is not (just) a number', function() {
      var data = { string: '{12 }', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(modifier).toBe(undefined);
      expect(data.hasError).toBe(true);
    });


    ///
    /// n to m occurences
    ///

    it('recognizes `{2,10}` to mean the previous expression should occur at least 2 and at most 10 times consecutively', function() {
      var n = 2;
      var m = 10;
      var data = { string: '{' + n + ',' + m + '}', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(modifier.min).toBe(n);
      expect(modifier.max).toBe(m);
    });

    it('recognizes `{0,9999}` to mean the previous expression should occur between 0 an 9999 times inclusive', function() {
      var n = 0;
      var m = 9999;
      var data = { string: '{' + n + ',' + m + '}', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(modifier.min).toBe(n);
      expect(modifier.max).toBe(m);
    });

    it('recognizes `{7,7}` to mean the previous expression should occur exactly 7 times', function() {
      var n = 7;
      var m = 7;
      var data = { string: '{' + n + ',' + m + '}', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(modifier.min).toBe(n);
      expect(modifier.max).toBe(m);
    });

    it('eats `{2,7}` after parsing it', function() {
      var data = { string: '{2,7}', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(data.pos).toBe(5);
    });

    it('fails on `{7,2}` because `7 > 2`', function() {
      var data = { string: '{7,2}', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(modifier).toBe(undefined);
      expect(data.hasError).toBe(true);
    });

    it('fails on `{-10,10}` because `-10` is negative', function() {
      var data = { string: '{-10,10}', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(modifier).toBe(undefined);
      expect(data.hasError).toBe(true);
    });

    it('fails on `{7.3,2}` because `7.3` is not an integer', function() {
      var data = { string: '{7.3,2}', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(modifier).toBe(undefined);
      expect(data.hasError).toBe(true);
    });

    it('fails on `{7,2.0}` because `2.0` is not an integer', function() {
      var data = { string: '{7,2.0}', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(modifier).toBe(undefined);
      expect(data.hasError).toBe(true);
    });

    it('fails on `{ 7,2}` because ` 7` is not just a number', function() {
      var data = { string: '{ 7,2}', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(modifier).toBe(undefined);
      expect(data.hasError).toBe(true);
    });

    it('fails on `{7, 2}` because ` 7` is not just a number', function() {
      var data = { string: '{7, 2}', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(modifier).toBe(undefined);
      expect(data.hasError).toBe(true);
    });

    it('fails on `{7,2.0}` because `2.0` is not an integer', function() {
      var n = 7;
      var m = 2.0;
      var data = { string: '{' + n + ',' + m + '}', pos: 0, hasError: false };
      var modifier = parseModifier(data);

      expect(modifier).toBe(undefined);
      expect(data.hasError).toBe(true);
    });


    ///
    /// no modifier
    ///

    it('recognizes anything that is not a modifier to mean the previous expression should match exactly once', function() {
      var data = { string: 'd1/foo/', pos: 0 };
      var modifier = parseModifier(data);

      expect(modifier.min).toBe(1);
      expect(modifier.max).toBe(1);
    });

    it('recognizes end of string/empty string to mean the previous expression should match exactly once', function() {
      var data = { string: '', pos: 0 };
      var modifier = parseModifier(data);

      expect(modifier.min).toBe(1);
      expect(modifier.max).toBe(1);
    });

    it('does not eat anything that is not a token', function() {
      var data = { string: 'd1/foo/', pos: 0 };
      var modifier = parseModifier(data);

      expect(data.pos).toBe(0);
    });

  });

  describe('when matching expressions', function() {

    it('recognizes `d2` as a `d`-action with id `2`', function() {
      var data = { string: 'd2', pos: 0, hasError: false };
      var token = parseAction(data);

      expect(data.hasError).toBe(false);
      expect(token.action).toBe('d');
      expect(token.id).toBe('2');
    });

    it('recognizes `u1` as a `u`-action with id `1`', function() {
      var data = { string: 'u1', pos: 0, hasError: false };
      var token = parseAction(data);

      expect(data.hasError).toBe(false);
      expect(token.action).toBe('u');
      expect(token.id).toBe('1');
    });

    it('recognizes `m333` as a `m`-action with id `333`', function() {
      var data = { string: 'm333', pos: 0, hasError: false };
      var token = parseAction(data);

      expect(data.hasError).toBe(false);
      expect(token.action).toBe('m');
      expect(token.id).toBe('333');
    });

    it('recognizes `m3.16` as a `m`-action with id `3` because the id is an integer', function() {
      var data = { string: 'm3.16', pos: 0, hasError: false };
      var token = parseAction(data);

      expect(data.hasError).toBe(false);
      expect(token.action).toBe('m');
      expect(token.id).toBe('3');
    });

    it('recognizes `d1/foo*bar/` as an action targeting an element with an id that matches the regular expression `foo*bar`', function() {
      var data = { string: 'd1/foo*bar/', pos: 0, hasError: false };
      var token = parseAction(data);

      expect(data.hasError).toBe(false);
      expect(token.target).toBe('foo*bar');
    });

    it('recognizes `d1` as an action targeting an element with an id that matches the regular expression `.*`', function() {
      var data = { string: 'd1', pos: 0, hasError: false };
      var token = parseAction(data);

      expect(data.hasError).toBe(false);
      expect(token.target).toBe('.*');
    });

    it('fails to parse `x2` because `x` is not a valid action', function() {
      var data = { string: 'x2', pos: 0, hasError: false };
      var token = parseAction(data);

      expect(data.hasError).toBe(true);
      expect(token).toBe(undefined);
    });

    it('fails to parse `d0` because the id cannot be 0', function() {
      var data = { string: 'd0', pos: 0, hasError: false };
      var token = parseAction(data);

      expect(data.hasError).toBe(true);
      expect(token).toBe(undefined);
    });

    it('fails to parse `doobar` because the action type is not followed by a number', function() {
      var data = { string: 'doobar', pos: 0, hasError: false };
      var token = parseAction(data);

      expect(data.hasError).toBe(true);
      expect(token).toBe(undefined);
    });

    it('fails to parse `d-12` because the action type is not followed by a number', function() {
      var data = { string: 'd-12', pos: 0, hasError: false };
      var token = parseAction(data);

      expect(data.hasError).toBe(true);
      expect(token).toBe(undefined);
    });

  });

});