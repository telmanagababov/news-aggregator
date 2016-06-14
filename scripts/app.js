/**
 *
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
APP.Main = (function() {

  var LAZY_LOAD_THRESHOLD = 300;
  var $ = document.querySelector.bind(document);

  var stories = null;
  var storyStart = 0;
  var count = 100;
  var main = $('main');
  var inDetails = false;
  var storyLoadCount = 0;
  var localeData = {
    data: {
      intl: {
        locales: 'en-US'
      }
    }
  };

  var tmplStory = $('#tmpl-story').textContent;
  var tmplStoryDetails = $('#tmpl-story-details').textContent;
  var tmplStoryDetailsComment = $('#tmpl-story-details-comment').textContent;

  if (typeof HandlebarsIntl !== 'undefined') {
    HandlebarsIntl.registerWith(Handlebars);
  } else {

    // Remove references to formatRelative, because Intl isn't supported.
    var intlRelative = /, {{ formatRelative time }}/;
    tmplStory = tmplStory.replace(intlRelative, '');
    tmplStoryDetails = tmplStoryDetails.replace(intlRelative, '');
    tmplStoryDetailsComment = tmplStoryDetailsComment.replace(intlRelative, '');
  }

  var storyTemplate =
      Handlebars.compile(tmplStory);
  var storyDetailsTemplate =
      Handlebars.compile(tmplStoryDetails);
  var storyDetailsCommentTemplate =
      Handlebars.compile(tmplStoryDetailsComment);

  var story = null;

  /**
   * As every single story arrives in shove its
   * content in at that exact moment. Feels like something
   * that should really be handled more delicately, and
   * probably in a requestAnimationFrame callback.
   */
  function onStoryData (key, details) {
    requestAnimationFrame(function(){
      updateStory(key, details);
    });
  }

  function updateStory(key, details) {
    var story = document.querySelector('#s-' + key);
    details.time *= 1000;
    story.innerHTML = storyTemplate(details);
    story.classList.add('clickable');
    story.addEventListener('click', onStoryClick.bind(this, details));
  }

  var storyDetails = null,
      storyDetailsComponent = null,
      comment = null,
      commentsElement = null,
      storyHeader = null,
      storyContent = null,
      storyDetailsHtml = null,
      kids = null,
      commentHtml = storyDetailsCommentTemplate({
        by: '', text: 'Loading comment...'
      }),
      closeButton = null,
      headerHeight = null;

  function onStoryClick(details) {

    storyDetails = $('sd-' + details.id);

    // Create and append the story. A visual change...
    // perhaps that should be in a requestAnimationFrame?
    // And maybe, since they're all the same, I don't
    // need to make a new element every single time? I mean,
    // it inflates the DOM and I can only see one at once.
    if (!storyDetails) {

      if (details.url)
        details.urlobj = new URL(details.url);

      requestAnimationFrame(function(){
        createStoryDetails(details);
      });
    }
    // Wait a little time then show the story details.
    requestAnimationFrame(function(){
      showStory.call(this);
    });
  }

  function createStoryDetails(details) {
    if(storyDetailsComponent === null) {
      storyDetailsComponent = document.createElement('section');
      storyDetailsComponent.classList.add('story-details');
      document.body.appendChild(storyDetailsComponent);
      storyDetailsHtml = storyDetailsTemplate(details);
      storyDetailsComponent.innerHTML = storyDetailsHtml;
      commentsElement = storyDetailsComponent.querySelector('.js-comments');
      storyHeader = storyDetailsComponent.querySelector('.js-header');
      storyContent = storyDetailsComponent.querySelector('.js-content');
      closeButton = storyDetailsComponent.querySelector('.js-close');
      closeButton.addEventListener('click', hideStory.bind(this));
      headerHeight = storyHeader.getBoundingClientRect().height;
      storyContent.style.paddingTop = headerHeight + 'px';
    }

    kids = details.kids;
    storyDetails = storyDetailsComponent;
    storyDetails.setAttribute('id', 'sd-' + details.id);

    if (typeof kids === 'undefined')
      return;

    for (var k = 0; k < kids.length; k++) {
      (function(id) {
        requestAnimationFrame(function () {addComment(id);});
      })(kids[k]);
    }
  }

  function addComment(id) {
    console.log("addComment: ", id);
    comment = document.createElement('aside');
    comment.setAttribute('id', 'sdc-' + id);
    comment.classList.add('story-details__comment');
    comment.innerHTML = commentHtml;
    commentsElement.appendChild(comment);
    // Update the comment with the live data.
    APP.Data.getStoryComment(id, function(commentDetails) {
      commentDetails.time *= 1000;
      comment = commentsElement.querySelector('#sdc-' + commentDetails.id);
      comment.innerHTML = storyDetailsCommentTemplate(commentDetails, localeData);
    });
  }

  var left = null,
      storyDetailsPosition = null;

  function showStory() {

    if (inDetails)
      return;

    inDetails = true;

    storyDetails.style.opacity = 1;

    // We want slick, right, so let's do a setTimeout
    // every few milliseconds. That's going to keep
    // it all tight. Or maybe we're doing visual changes
    // and they should be in a requestAnimationFrame
    storyDetailsPosition = storyDetails.getBoundingClientRect();
    requestAnimationFrame(animateShow);
  }

  function animateShow () {

    // Set the left value if we don't have one already.
    if (left === null)
      left = storyDetailsPosition.left;

    // Now figure out where it needs to go.
    left += (0 - storyDetailsPosition.left) * 0.1;
    storyDetailsPosition.left = left;

    // Set up the next bit of the animation if there is more to do.
    if (Math.abs(left) > 0.5)
      requestAnimationFrame(animateShow);
    else
      left = 0;

    // And update the styles. Wait, is this a read-write cycle?
    // I hope I don't trigger a forced synchronous layout!
    storyDetails.style.left = left + 'px';
  }

  var mainPosition = null,
      target = null;
    
  function hideStory() {

    if (!inDetails)
      return;

    storyDetails.style.opacity = 0;

    // We want slick, right, so let's do a setTimeout
    // every few milliseconds. That's going to keep
    // it all tight. Or maybe we're doing visual changes
    // and they should be in a requestAnimationFrame
    storyDetailsPosition = storyDetails.getBoundingClientRect();
    requestAnimationFrame(animateHide);
  }

  function animateHide () {

    // Find out where it currently is.
    mainPosition = main.getBoundingClientRect();
    target = mainPosition.width + 100;

    // Now figure out where it needs to go.
    left += (target - storyDetailsPosition.left) * 0.1;
    storyDetailsPosition.left = left;

    // Set up the next bit of the animation if there is more to do.
    if (Math.abs(left - target) > 0.5) {
      requestAnimationFrame(animateHide);
    } else {
      left = target;
      inDetails = false;
    }

    // And update the styles. Wait, is this a read-write cycle?
    // I hope I don't trigger a forced synchronous layout!
    storyDetails.style.left = left + 'px';
  }

  var renderedStoryElements = 0,
      storyElements = null,
      storyElementsLength = null,
      score = null,
      title = null,
      height = null,
      scoreLocation = null,
      scale = null,
      opacity = null,
      bodyClientRect = null,
      saturation = null,
      i = null;

  /**
   * Does this really add anything? Can we do this kind
   * of work in a cheaper way?
   */
  function colorizeAndScaleStories() {
    // It does seem awfully broad to change all the
    // colors every time!
    storyElements = document.querySelectorAll('.story');
    storyElementsLength = storyElements.length;
    if(renderedStoryElements < storyElementsLength) {

      bodyClientRect = document.body.getBoundingClientRect().top;

      for (i = renderedStoryElements; i < storyElementsLength; i++) {
        story = storyElements[i];
        score = story.querySelector('.story__score');
        title = story.querySelector('.story__title');
        // Base the scale on the y position of the score.
        height = main.offsetHeight;
        scoreLocation = score.getBoundingClientRect().top - bodyClientRect;
        scale = Math.min(1, 1 - (0.05 * ((scoreLocation - 170) / height)));
        opacity = Math.min(1, 1 - (0.5 * ((scoreLocation - 170) / height)));

        score.style.width = (scale * 40) + 'px';
        score.style.height = (scale * 40) + 'px';
        score.style.lineHeight = (scale * 40) + 'px';

        // Now figure out how wide it is and use that to saturate it.
        scoreLocation = score.getBoundingClientRect();
        saturation = (100 * ((scoreLocation.width - 38) / 2));

        score.style.backgroundColor = 'hsl(42, ' + saturation + '%, 50%)';
        title.style.opacity = opacity;
      }
      renderedStoryElements = storyElementsLength;
    }
  }

  main.addEventListener('touchstart', function(evt) {

    // I just wanted to test what happens if touchstart
    // gets canceled. Hope it doesn't block scrolling on mobiles...
    if (Math.random() > 0.97) {
      evt.preventDefault();
    }

  });

  var header = $('header'),
      headerTitles = header.querySelector('.header__title-wrapper'),
      scrollTop = null,
      scrollTopCapped = null,
      scaleString = null,
      loadThreshold = null;

  main.addEventListener('scroll', function() {
    scrollTop = main.scrollTop;
    scrollTopCapped = Math.min(70, scrollTop);
    scaleString = 'scale(' + (1 - (scrollTopCapped / 300)) + ')';

    if(scrollTopCapped !== 70 || headerHeight !== "86px") {
      headerHeight = (156 - scrollTopCapped) + 'px';
      header.style.height = headerHeight;
      headerTitles.style.webkitTransform = scaleString;
      headerTitles.style.transform = scaleString;
    }

    // Add a shadow to the header.
    if (scrollTop > 70)
      document.body.classList.add('raised');
    else
      document.body.classList.remove('raised');

    // Check if we need to load the next batch of stories.
    loadThreshold = (main.scrollHeight - main.offsetHeight - LAZY_LOAD_THRESHOLD);
    if (scrollTop > loadThreshold)
      loadStoryBatch();
      colorizeAndScaleStories();
  });

  function loadStoryBatch() {
    if (storyLoadCount > 0)
      return;

    storyLoadCount = count;

    var end = storyStart + count;
    for (var i = storyStart; i < end; i++) {

      if (i >= stories.length)
        return;

      var key = String(stories[i]);
      var story = document.createElement('div');
      story.setAttribute('id', 's-' + key);
      story.classList.add('story');
      story.innerHTML = storyTemplate({
        title: '...',
        score: '-',
        by: '...',
        time: 0
      });
      main.appendChild(story);

      APP.Data.getStoryById(stories[i], onStoryData.bind(this, key));
    }

    storyLoadCount = 0;
    storyStart += count;
    colorizeAndScaleStories();
  }

  // Bootstrap in the stories.
  APP.Data.getTopStories(function(data) {
    stories = data;
    loadStoryBatch();
    main.classList.remove('loading');
  });

})();
