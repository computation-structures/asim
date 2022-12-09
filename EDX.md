## Creating ASim problems in edX

ASim can be integrated into edX using the "Custom Javascript Display and Grading"
problem type.  First, you need to upload ASim itself into the directory of files
associated with your edX course:

* in edX Studio, click on the Content dropdown at the top of the page,
the select "Files & Uploads".

* upload the following files, which you'll find at the top level this
repo:

  * asim.min.js
  * asim.min.css
  * asim_edx.html

Here are the steps to create an edX student exercise that uses ASim:

* In your course outline, locate/create the subsection where the
exercise will be located.

* Click on "New Unit", then in the "Add New Component" menu click
on "Problem".

* Select the "Advanced" tab, then click on "Custom JavaScript Display
and Grading" problem type.  This will provide a template that's initially
filled in with an example problem.  Here's the
<a href="https://edx.readthedocs.io/projects/open-edx-building-and-running-a-course/en/open-release-eucalyptus.master/exercises_tools/custom_javascript.html">documentation</a> for
the Custom JavaScript Problem type.

* Click on "Edit", select and delete the current contents of the editor
buffer.  Replace with the following:

    <problem>

      <script type="loncapa/python">
    import json
    def verify_checksum(expect, ans):
        response = json.loads(ans)
        return response["answer"] == expected
      </script>

      <p> This text is displayed before the ASim instance. </p>

      <customresponse cfn="verify_checksum" expect="<checksum>">
        <jsinput title="ASim"
                 gradefn="gradefn"
                 height="600"
                 width="100%"
                 get_statefn="getstate"
                 set_statefn="setstate"
                 initial_state='{"buffers":[<bufferspecs>]}'
                 html_file="/static/asim_edx.html"/>
      </customresponse>

    </problem>

* Modify the template, replacing `<bufferspecs>` with a
comma-separated list of <a href="https://www.json.org/json-en.html">JSON</a>
objects that specify which files you'd like to have pre-loaded into
the ASim editor buffers.  For example, to load a file called `test.s`,
you would specify `{"name":"test.s","url":"test.s"}`.  Note that JSON
is very particular about the syntax; in particular, you cannot have an
extra comma following the final name/value pair as would be allowed in
Python or Javascript.

* You can mark a pre-loaded buffer as read-only by including `"readonly":true`
as one of the name/value pairs in the your buffer spec.  This is useful
for instructor-supplied code such as test jigs.

* Edit the paragraph "This text is displayed..." to describe what you'd
like the student to do.  Note that edX is very particular about the
HTML syntax: it must follow the XHTML standard where every tag
has a matching closing tag.

* To support grading of your ASim problem, you'll need to replace
`<checksum>` with the appropriate string.  Please see the "Grading"
section below.

* While you're in the editor window, you can click on "Settings"
at top of the editor window and make the appropriate entries
for the problem's attributes, e.g., the display name.  If you would
like students to see a "Save" button, you should set the maximum
attempts property to a non-zero value.

* When you've completed your edits, click "Save" at the bottom of
the editor window.  If all is well, you should see a preview of your
new problem.  Remember to 
